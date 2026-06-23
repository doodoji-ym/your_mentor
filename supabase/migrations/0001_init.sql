-- ============================================================
-- AI 튜터 — 초기 스키마 + RLS
-- architecture.md §3(역할/권한), §4(데이터 모델), §5(이해도 게이팅) 반영
-- ============================================================

-- ---------- ENUMS ----------
create type user_role        as enum ('admin', 'teacher', 'student');
create type subject_t        as enum ('math', 'english');          -- MVP는 math, 확장 대비 컬럼화
create type conv_mode        as enum ('solve', 'review');          -- solve=미공개 문제, review=답지 해설
create type conv_status      as enum ('active', 'resolved');
create type msg_sender       as enum ('student', 'assistant');
create type guardrail_flag_t as enum ('ok', 'blocked_offtopic', 'redacted_premature_answer', 'answer_disclosed');

-- ---------- TABLES ----------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         user_role not null default 'student',
  display_name text,
  created_by   uuid references public.profiles(id) on delete set null,  -- 계층·소유권
  grade        int,                                                     -- 학년 → 교과 스코핑
  created_at   timestamptz not null default now()
);

create table public.teacher_students (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.profiles(id) on delete cascade,
  subject             subject_t not null default 'math',
  problem_image_url   text,
  problem_text        text,
  mode                conv_mode not null default 'solve',
  status              conv_status not null default 'active',
  understanding_score int not null default 0 check (understanding_score between 0 and 100),  -- §5 이해도 게이팅
  answer_disclosed    boolean not null default false,
  created_at          timestamptz not null default now()
);
create index on public.conversations (student_id);

create table public.messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references public.conversations(id) on delete cascade,
  sender                msg_sender not null,
  content               text not null,
  guardrail_flag        guardrail_flag_t not null default 'ok',
  understanding_at_turn int check (understanding_at_turn between 0 and 100),
  created_at            timestamptz not null default now()
);
create index on public.messages (conversation_id);

-- ---------- HELPERS (SECURITY DEFINER로 RLS 재귀 방지) ----------
create or replace function public.app_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_teacher_of(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teacher_students
    where teacher_id = auth.uid() and student_id = p_student
  )
$$;

-- 신규 auth 사용자 → profiles 자동 생성(기본 role=student)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.profiles         enable row level security;
alter table public.teacher_students enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;

-- profiles
create policy "profiles: own read"        on public.profiles for select using (id = auth.uid());
create policy "profiles: teacher reads students" on public.profiles for select using (public.is_teacher_of(id));
create policy "profiles: admin reads all" on public.profiles for select using (public.app_role() = 'admin');
create policy "profiles: own update"      on public.profiles for update using (id = auth.uid());
create policy "profiles: teacher updates students" on public.profiles for update using (public.is_teacher_of(id));

-- teacher_students (생성/삭제는 service_role 서버 액션으로 — RLS 우회)
create policy "links: teacher reads own" on public.teacher_students for select using (teacher_id = auth.uid());
create policy "links: admin reads all"   on public.teacher_students for select using (public.app_role() = 'admin');

-- conversations: 학생은 자기 것 CRUD, 선생님은 자기 학생 것 읽기
create policy "conv: student all" on public.conversations
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "conv: teacher reads students" on public.conversations
  for select using (public.is_teacher_of(student_id));

-- messages: 대화 소유 학생은 CRUD, 선생님은 자기 학생 대화 읽기
create policy "msg: student all" on public.messages
  for all
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.student_id = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.student_id = auth.uid()));
create policy "msg: teacher reads students" on public.messages
  for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_teacher_of(c.student_id)));

-- ============================================================
-- 첫 관리자 지정: 본인 가입 후 아래를 SQL Editor에서 1회 실행
--   update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
-- ============================================================
