/*
 Opla schema snapshot. Schema only, no data.

 Alembic revision: 033_ai_credits
 Source: local opla_db after it was aligned with opla-backend models and the remote database.
 The public schema is assumed to already exist (created with the database).
 Apply this file to an empty database. Do not run it against a database that already has these tables.
 Migrations remain the way to upgrade an existing database: alembic upgrade head.
*/

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accessor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.accessor_type AS ENUM (
    'user',
    'team'
);


--
-- Name: form_automation_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_automation_action AS ENUM (
    'create_task',
    'create_alert'
);


--
-- Name: form_automation_event; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_automation_event AS ENUM (
    'submission_created',
    'submission_reviewed',
    'submission_approved'
);


--
-- Name: form_dataset_field_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_dataset_field_status AS ENUM (
    'active',
    'legacy'
);


--
-- Name: form_dataset_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_dataset_status AS ENUM (
    'active',
    'archived'
);


--
-- Name: form_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_kind AS ENUM (
    'standard',
    'directory'
);


--
-- Name: form_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_status AS ENUM (
    'draft',
    'live',
    'archived'
);


--
-- Name: form_version_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_version_kind AS ENUM (
    'draft',
    'live'
);


--
-- Name: global_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.global_role AS ENUM (
    'admin',
    'member'
);


--
-- Name: invitation_approval_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_approval_mode AS ENUM (
    'auto',
    'review'
);


--
-- Name: invitation_delivery_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_delivery_mode AS ENUM (
    'email',
    'short_link',
    'generated_link',
    'pin_code'
);


--
-- Name: invitation_lifecycle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_lifecycle_status AS ENUM (
    'pending',
    'approved',
    'accepted',
    'revoked',
    'declined'
);


--
-- Name: invitation_member_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_member_type AS ENUM (
    'internal',
    'contractor'
);


--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'accepted'
);


--
-- Name: invitation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_type AS ENUM (
    'organization',
    'team'
);


--
-- Name: member_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.member_type AS ENUM (
    'internal',
    'contractor'
);


--
-- Name: project_asset_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_asset_kind AS ENUM (
    'document',
    'image',
    'audio',
    'link'
);


--
-- Name: project_attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_attendance_status AS ENUM (
    'checked_in',
    'checked_out'
);


--
-- Name: project_report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_report_status AS ENUM (
    'draft',
    'published',
    'archived'
);


--
-- Name: project_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_role AS ENUM (
    'collector',
    'analyst',
    'editor'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'planning',
    'active',
    'paused',
    'archived'
);


--
-- Name: project_task_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_task_kind AS ENUM (
    'general',
    'field_visit'
);


--
-- Name: project_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_task_status AS ENUM (
    'todo',
    'in_progress',
    'done',
    'blocked',
    'cancelled'
);


--
-- Name: submission_review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.submission_review_status AS ENUM (
    'submitted',
    'approved',
    'rejected'
);


--
-- Name: template_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.template_visibility AS ENUM (
    'organization',
    'team'
);


SET default_table_access_method = heap;

--
-- Name: ai_credit_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_credit_ledger (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    entry_type character varying NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    action_key character varying,
    note text,
    actor_user_id uuid,
    related_entry_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_ai_credit_ledger_balance_after_nonnegative CHECK ((balance_after >= 0)),
    CONSTRAINT ck_ai_credit_ledger_entry_type CHECK (((entry_type)::text = ANY ((ARRAY['top_up'::character varying, 'spend'::character varying, 'refund'::character varying])::text[])))
);


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: analytics_dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_dashboards (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    created_by uuid,
    title character varying NOT NULL,
    description text,
    layout_config jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_cards (
    id uuid NOT NULL,
    dashboard_id uuid NOT NULL,
    question_id uuid NOT NULL,
    "position" jsonb NOT NULL,
    viz_override jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form_automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_automation_rules (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    event_type public.form_automation_event NOT NULL,
    action_type public.form_automation_action NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    conditions_json jsonb,
    action_config_json jsonb NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form_dataset_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_dataset_fields (
    id uuid NOT NULL,
    dataset_id uuid NOT NULL,
    field_identifier character varying NOT NULL,
    field_key character varying NOT NULL,
    label character varying,
    field_type character varying,
    status public.form_dataset_field_status DEFAULT 'active'::public.form_dataset_field_status NOT NULL,
    introduced_in_version_number integer NOT NULL,
    retired_in_version_number integer,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form_dataset_schema_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_dataset_schema_versions (
    id uuid NOT NULL,
    dataset_id uuid NOT NULL,
    form_version_id uuid,
    version_number integer NOT NULL,
    schema_snapshot jsonb NOT NULL,
    blueprint_snapshot jsonb NOT NULL,
    change_summary_json jsonb,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form_datasets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_datasets (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    status public.form_dataset_status DEFAULT 'active'::public.form_dataset_status NOT NULL,
    lookup_enabled boolean DEFAULT false NOT NULL,
    current_schema_version_number integer DEFAULT 0 NOT NULL,
    last_form_version_number integer,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    public_lookup_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: form_submission_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submission_media (
    id uuid NOT NULL,
    submission_id uuid NOT NULL,
    form_id uuid NOT NULL,
    project_id uuid NOT NULL,
    field_bind character varying NOT NULL,
    field_label character varying,
    field_type character varying NOT NULL,
    media_kind character varying NOT NULL,
    url text,
    filename character varying,
    mime_type character varying,
    byte_size integer,
    payload jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: form_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_versions (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    version_number integer NOT NULL,
    kind public.form_version_kind NOT NULL,
    slot_index integer,
    blueprint jsonb NOT NULL,
    created_by uuid,
    changelog text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone NOT NULL,
    published_at timestamp without time zone
);


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title character varying NOT NULL,
    slug character varying NOT NULL,
    blueprint_draft jsonb,
    blueprint_live jsonb,
    version integer DEFAULT 1 NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    status public.form_status DEFAULT 'draft'::public.form_status NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    published_version integer,
    published_at timestamp without time zone,
    lead_accessor_id uuid,
    lead_accessor_type public.accessor_type,
    assigned_accessor_id uuid,
    assigned_accessor_type public.accessor_type,
    guest_accessor_id uuid,
    guest_accessor_type public.accessor_type,
    kind public.form_kind DEFAULT 'standard'::public.form_kind NOT NULL,
    directory_key_field_id character varying,
    directory_label_field_id character varying
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    team_id uuid,
    invitation_type public.invitation_type NOT NULL,
    member_type public.invitation_member_type NOT NULL,
    delivery_mode public.invitation_delivery_mode NOT NULL,
    approval_mode public.invitation_approval_mode NOT NULL,
    status public.invitation_lifecycle_status DEFAULT 'pending'::public.invitation_lifecycle_status NOT NULL,
    invited_email character varying,
    token character varying,
    pin_code character varying,
    created_by uuid NOT NULL,
    claimed_by uuid,
    approved_by uuid,
    accepted_by uuid,
    claimed_at timestamp without time zone,
    approved_at timestamp without time zone,
    accepted_at timestamp without time zone,
    expires_at timestamp without time zone,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: org_ai_action_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_ai_action_costs (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    action_key character varying NOT NULL,
    label character varying NOT NULL,
    credit_cost integer NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_org_ai_action_costs_nonnegative CHECK ((credit_cost >= 0))
);


--
-- Name: org_ai_credit_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_ai_credit_balances (
    organization_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_org_ai_credit_balances_nonnegative CHECK ((balance >= 0))
);


--
-- Name: org_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    global_role public.global_role DEFAULT 'member'::public.global_role NOT NULL,
    invited_by uuid,
    invitation_status public.invitation_status DEFAULT 'pending'::public.invitation_status NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    member_type public.member_type DEFAULT 'internal'::public.member_type NOT NULL
);


--
-- Name: org_message_opt_outs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_message_opt_outs (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    phone character varying NOT NULL,
    channel character varying DEFAULT 'sms'::character varying NOT NULL,
    reason character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: org_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_role_assignments (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    role_id uuid NOT NULL,
    accessor_id uuid NOT NULL,
    accessor_type character varying NOT NULL,
    assigned_by uuid,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: org_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_roles (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    description character varying,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    is_system boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    owner_id uuid NOT NULL,
    logo_url character varying,
    primary_color character varying DEFAULT '#6366f1'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: project_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    accessor_id uuid NOT NULL,
    accessor_type public.accessor_type NOT NULL,
    role public.project_role,
    role_template_id uuid
);


--
-- Name: project_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assets (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    title character varying NOT NULL,
    kind public.project_asset_kind DEFAULT 'document'::public.project_asset_kind NOT NULL,
    summary text,
    source_url text,
    created_by uuid,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: project_attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_attendance_records (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    attendance_date date NOT NULL,
    status public.project_attendance_status NOT NULL,
    check_in_at timestamp without time zone NOT NULL,
    check_in_location_json jsonb NOT NULL,
    check_in_note text,
    check_in_image_uri character varying,
    check_in_signature character varying,
    check_out_at timestamp without time zone,
    check_out_location_json jsonb,
    check_out_note text,
    check_out_image_uri character varying,
    check_out_signature character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: project_attention_hooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_attention_hooks (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    kind character varying NOT NULL,
    severity_default character varying DEFAULT 'warning'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    config_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_attention_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_attention_items (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    hook_id uuid,
    severity character varying NOT NULL,
    kind character varying NOT NULL,
    title character varying NOT NULL,
    detail text,
    deep_link character varying,
    status character varying DEFAULT 'open'::character varying NOT NULL,
    dedupe_key character varying NOT NULL,
    source_submission_id uuid,
    source_task_id uuid,
    source_attendance_id uuid,
    source_channel_id uuid,
    dismissed_at timestamp without time zone,
    dismissed_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    source_automation_rule_id uuid
);


--
-- Name: project_broadcast_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_broadcast_deliveries (
    id uuid NOT NULL,
    broadcast_id uuid NOT NULL,
    phone character varying NOT NULL,
    name character varying,
    user_id uuid,
    sources jsonb,
    team_names jsonb,
    parts integer DEFAULT 1 NOT NULL,
    status character varying DEFAULT 'queued'::character varying NOT NULL,
    error text,
    provider_ref character varying,
    attempts integer DEFAULT 0 NOT NULL,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_broadcasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_broadcasts (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    created_by uuid,
    channel character varying DEFAULT 'sms'::character varying NOT NULL,
    provider character varying NOT NULL,
    sender_id character varying,
    body text NOT NULL,
    name_fallback character varying,
    status character varying DEFAULT 'queued'::character varying NOT NULL,
    audience_json jsonb,
    recipient_count integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    estimated_credits integer DEFAULT 0 NOT NULL,
    credits_used double precision,
    last_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone
);


--
-- Name: project_directory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_directory_items (
    id uuid CONSTRAINT project_catalog_items_id_not_null NOT NULL,
    project_id uuid CONSTRAINT project_catalog_items_project_id_not_null NOT NULL,
    sku_code character varying CONSTRAINT project_catalog_items_sku_code_not_null NOT NULL,
    label character varying CONSTRAINT project_catalog_items_label_not_null NOT NULL,
    default_price double precision,
    unit character varying,
    brand character varying,
    is_active boolean DEFAULT true CONSTRAINT project_catalog_items_is_active_not_null NOT NULL,
    price_editable boolean DEFAULT true CONSTRAINT project_catalog_items_price_editable_not_null NOT NULL,
    metadata_json jsonb,
    created_by uuid,
    created_at timestamp without time zone CONSTRAINT project_catalog_items_created_at_not_null NOT NULL,
    updated_at timestamp without time zone CONSTRAINT project_catalog_items_updated_at_not_null NOT NULL
);


--
-- Name: project_message_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_message_channels (
    id uuid CONSTRAINT project_threads_id_not_null NOT NULL,
    project_id uuid CONSTRAINT project_threads_project_id_not_null NOT NULL,
    title character varying CONSTRAINT project_threads_title_not_null NOT NULL,
    summary text,
    reply_count integer DEFAULT 0 CONSTRAINT project_threads_reply_count_not_null NOT NULL,
    created_by uuid,
    created_at timestamp without time zone CONSTRAINT project_threads_created_at_not_null NOT NULL,
    updated_at timestamp without time zone CONSTRAINT project_threads_updated_at_not_null NOT NULL,
    kind character varying DEFAULT 'general'::character varying CONSTRAINT project_threads_kind_not_null NOT NULL,
    team_id uuid,
    archived_at timestamp without time zone
);


--
-- Name: project_message_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_message_notifications (
    id uuid CONSTRAINT project_thread_notifications_id_not_null NOT NULL,
    user_id uuid CONSTRAINT project_thread_notifications_user_id_not_null NOT NULL,
    project_id uuid CONSTRAINT project_thread_notifications_project_id_not_null NOT NULL,
    channel_id uuid CONSTRAINT project_thread_notifications_thread_id_not_null NOT NULL,
    message_id uuid CONSTRAINT project_thread_notifications_message_id_not_null NOT NULL,
    kind character varying DEFAULT 'mention'::character varying CONSTRAINT project_thread_notifications_kind_not_null NOT NULL,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() CONSTRAINT project_thread_notifications_created_at_not_null NOT NULL
);


--
-- Name: project_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_messages (
    id uuid CONSTRAINT project_thread_messages_id_not_null NOT NULL,
    channel_id uuid CONSTRAINT project_thread_messages_thread_id_not_null NOT NULL,
    project_id uuid CONSTRAINT project_thread_messages_project_id_not_null NOT NULL,
    author_id uuid,
    body text CONSTRAINT project_thread_messages_body_not_null NOT NULL,
    mentions_json jsonb,
    created_at timestamp without time zone DEFAULT now() CONSTRAINT project_thread_messages_created_at_not_null NOT NULL,
    edited_at timestamp without time zone,
    deleted_at timestamp without time zone,
    deleted_by uuid
);


--
-- Name: project_pinned_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_pinned_analytics (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    question_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_reports (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    title character varying NOT NULL,
    description text,
    status public.project_report_status DEFAULT 'draft'::public.project_report_status NOT NULL,
    lead_accessor_id uuid,
    lead_accessor_type public.accessor_type,
    assigned_accessor_id uuid,
    assigned_accessor_type public.accessor_type,
    guest_accessor_id uuid,
    guest_accessor_type public.accessor_type,
    created_by uuid,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    content jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: project_role_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_role_templates (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    description character varying,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tasks (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    title character varying NOT NULL,
    description text,
    status public.project_task_status DEFAULT 'todo'::public.project_task_status NOT NULL,
    starts_at timestamp without time zone,
    due_at timestamp without time zone,
    assigned_accessor_id uuid,
    assigned_accessor_type public.accessor_type,
    completed_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    kind public.project_task_kind NOT NULL,
    scheduled_date date,
    source_submission_id uuid,
    context_json jsonb,
    automation_rule_id uuid
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public.project_status DEFAULT 'planning'::public.project_status NOT NULL,
    activated_at timestamp without time zone,
    paused_at timestamp without time zone,
    archived_at timestamp without time zone,
    collection_start_date date,
    collection_end_date date,
    collection_time_start time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    collection_time_end time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    expected_total_count integer,
    expected_weekly_count integer DEFAULT 1
);


--
-- Name: saved_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_questions (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    created_by uuid,
    title character varying NOT NULL,
    description text,
    source_config jsonb NOT NULL,
    query_config jsonb NOT NULL,
    viz_type character varying(50) DEFAULT 'table'::character varying NOT NULL,
    viz_config jsonb,
    cache_ttl_seconds integer,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: section_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_templates (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    blueprint jsonb NOT NULL,
    visibility public.template_visibility NOT NULL,
    team_ids uuid[],
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    user_id uuid,
    data jsonb NOT NULL,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    form_version_number integer,
    dataset_id uuid,
    dataset_schema_version_id uuid,
    review_status public.submission_review_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_comment text,
    directory_is_active boolean
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying,
    email character varying,
    password_hash character varying,
    full_name character varying NOT NULL,
    is_platform_admin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: org_role_assignments _org_accessor_uc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_role_assignments
    ADD CONSTRAINT _org_accessor_uc UNIQUE (org_id, accessor_id, accessor_type);


--
-- Name: org_roles _org_role_slug_uc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT _org_role_slug_uc UNIQUE (org_id, slug);


--
-- Name: project_access _project_accessor_uc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_access
    ADD CONSTRAINT _project_accessor_uc UNIQUE (project_id, accessor_id, accessor_type);


--
-- Name: project_role_templates _project_role_template_slug_uc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_role_templates
    ADD CONSTRAINT _project_role_template_slug_uc UNIQUE (org_id, slug);


--
-- Name: team_members _team_user_uc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT _team_user_uc UNIQUE (team_id, user_id);


--
-- Name: org_members _user_org_uc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT _user_org_uc UNIQUE (user_id, org_id);


--
-- Name: ai_credit_ledger ai_credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credit_ledger
    ADD CONSTRAINT ai_credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: analytics_dashboards analytics_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_dashboards
    ADD CONSTRAINT analytics_dashboards_pkey PRIMARY KEY (id);


--
-- Name: dashboard_cards dashboard_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_cards
    ADD CONSTRAINT dashboard_cards_pkey PRIMARY KEY (id);


--
-- Name: form_automation_rules form_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_automation_rules
    ADD CONSTRAINT form_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: form_dataset_fields form_dataset_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_dataset_fields
    ADD CONSTRAINT form_dataset_fields_pkey PRIMARY KEY (id);


--
-- Name: form_dataset_schema_versions form_dataset_schema_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_dataset_schema_versions
    ADD CONSTRAINT form_dataset_schema_versions_pkey PRIMARY KEY (id);


--
-- Name: form_datasets form_datasets_form_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_datasets
    ADD CONSTRAINT form_datasets_form_id_key UNIQUE (form_id);


--
-- Name: form_datasets form_datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_datasets
    ADD CONSTRAINT form_datasets_pkey PRIMARY KEY (id);


--
-- Name: form_submission_media form_submission_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submission_media
    ADD CONSTRAINT form_submission_media_pkey PRIMARY KEY (id);


--
-- Name: form_versions form_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_versions
    ADD CONSTRAINT form_versions_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: org_ai_action_costs org_ai_action_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_ai_action_costs
    ADD CONSTRAINT org_ai_action_costs_pkey PRIMARY KEY (id);


--
-- Name: org_ai_credit_balances org_ai_credit_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_ai_credit_balances
    ADD CONSTRAINT org_ai_credit_balances_pkey PRIMARY KEY (organization_id);


--
-- Name: org_members org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_pkey PRIMARY KEY (id);


--
-- Name: org_message_opt_outs org_message_opt_outs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_message_opt_outs
    ADD CONSTRAINT org_message_opt_outs_pkey PRIMARY KEY (id);


--
-- Name: org_role_assignments org_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_role_assignments
    ADD CONSTRAINT org_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: org_roles org_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT org_roles_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: project_access project_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_access
    ADD CONSTRAINT project_access_pkey PRIMARY KEY (id);


--
-- Name: project_assets project_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_pkey PRIMARY KEY (id);


--
-- Name: project_attendance_records project_attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attendance_records
    ADD CONSTRAINT project_attendance_records_pkey PRIMARY KEY (id);


--
-- Name: project_attention_hooks project_attention_hooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_hooks
    ADD CONSTRAINT project_attention_hooks_pkey PRIMARY KEY (id);


--
-- Name: project_attention_items project_attention_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_pkey PRIMARY KEY (id);


--
-- Name: project_broadcast_deliveries project_broadcast_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcast_deliveries
    ADD CONSTRAINT project_broadcast_deliveries_pkey PRIMARY KEY (id);


--
-- Name: project_broadcasts project_broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcasts
    ADD CONSTRAINT project_broadcasts_pkey PRIMARY KEY (id);


--
-- Name: project_directory_items project_catalog_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_directory_items
    ADD CONSTRAINT project_catalog_items_pkey PRIMARY KEY (id);


--
-- Name: project_pinned_analytics project_pinned_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pinned_analytics
    ADD CONSTRAINT project_pinned_analytics_pkey PRIMARY KEY (id);


--
-- Name: project_reports project_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_reports
    ADD CONSTRAINT project_reports_pkey PRIMARY KEY (id);


--
-- Name: project_role_templates project_role_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_role_templates
    ADD CONSTRAINT project_role_templates_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_messages project_thread_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_thread_messages_pkey PRIMARY KEY (id);


--
-- Name: project_message_notifications project_thread_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_notifications
    ADD CONSTRAINT project_thread_notifications_pkey PRIMARY KEY (id);


--
-- Name: project_message_channels project_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_channels
    ADD CONSTRAINT project_threads_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: saved_questions saved_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_questions
    ADD CONSTRAINT saved_questions_pkey PRIMARY KEY (id);


--
-- Name: section_templates section_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_templates
    ADD CONSTRAINT section_templates_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: invitations uq_invitations_pin_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT uq_invitations_pin_code UNIQUE (pin_code);


--
-- Name: invitations uq_invitations_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT uq_invitations_token UNIQUE (token);


--
-- Name: org_ai_action_costs uq_org_ai_action_costs_org_action; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_ai_action_costs
    ADD CONSTRAINT uq_org_ai_action_costs_org_action UNIQUE (organization_id, action_key);


--
-- Name: org_message_opt_outs uq_org_message_opt_out; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_message_opt_outs
    ADD CONSTRAINT uq_org_message_opt_out UNIQUE (org_id, channel, phone);


--
-- Name: project_attendance_records uq_project_attendance_project_user_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attendance_records
    ADD CONSTRAINT uq_project_attendance_project_user_date UNIQUE (project_id, user_id, attendance_date);


--
-- Name: project_attention_items uq_project_attention_dedupe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT uq_project_attention_dedupe UNIQUE (project_id, dedupe_key);


--
-- Name: project_attention_hooks uq_project_attention_hook_kind; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_hooks
    ADD CONSTRAINT uq_project_attention_hook_kind UNIQUE (project_id, kind);


--
-- Name: project_broadcast_deliveries uq_project_broadcast_delivery_phone; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcast_deliveries
    ADD CONSTRAINT uq_project_broadcast_delivery_phone UNIQUE (broadcast_id, phone);


--
-- Name: project_pinned_analytics uq_project_pinned_question; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pinned_analytics
    ADD CONSTRAINT uq_project_pinned_question UNIQUE (project_id, question_id);


--
-- Name: form_submission_media uq_submission_media_field; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submission_media
    ADD CONSTRAINT uq_submission_media_field UNIQUE (submission_id, field_bind);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_ai_credit_ledger_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_credit_ledger_created_at ON public.ai_credit_ledger USING btree (created_at);


--
-- Name: ix_ai_credit_ledger_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_credit_ledger_organization_id ON public.ai_credit_ledger USING btree (organization_id);


--
-- Name: ix_analytics_dashboards_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_analytics_dashboards_org_id ON public.analytics_dashboards USING btree (org_id);


--
-- Name: ix_analytics_dashboards_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_analytics_dashboards_project_id ON public.analytics_dashboards USING btree (project_id);


--
-- Name: ix_dashboard_cards_dashboard_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dashboard_cards_dashboard_id ON public.dashboard_cards USING btree (dashboard_id);


--
-- Name: ix_dashboard_cards_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dashboard_cards_question_id ON public.dashboard_cards USING btree (question_id);


--
-- Name: ix_form_automation_rules_form_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_automation_rules_form_id ON public.form_automation_rules USING btree (form_id);


--
-- Name: ix_form_dataset_fields_dataset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_dataset_fields_dataset_id ON public.form_dataset_fields USING btree (dataset_id);


--
-- Name: ix_form_dataset_fields_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_form_dataset_fields_unique ON public.form_dataset_fields USING btree (dataset_id, field_identifier);


--
-- Name: ix_form_dataset_schema_versions_dataset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_dataset_schema_versions_dataset_id ON public.form_dataset_schema_versions USING btree (dataset_id);


--
-- Name: ix_form_dataset_schema_versions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_form_dataset_schema_versions_unique ON public.form_dataset_schema_versions USING btree (dataset_id, version_number);


--
-- Name: ix_form_datasets_form_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_datasets_form_id ON public.form_datasets USING btree (form_id);


--
-- Name: ix_form_datasets_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_datasets_slug ON public.form_datasets USING btree (slug);


--
-- Name: ix_form_submission_media_form_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_submission_media_form_created ON public.form_submission_media USING btree (form_id, created_at);


--
-- Name: ix_form_submission_media_form_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_submission_media_form_id ON public.form_submission_media USING btree (form_id);


--
-- Name: ix_form_submission_media_media_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_submission_media_media_kind ON public.form_submission_media USING btree (media_kind);


--
-- Name: ix_form_submission_media_project_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_submission_media_project_created ON public.form_submission_media USING btree (project_id, created_at);


--
-- Name: ix_form_submission_media_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_submission_media_project_id ON public.form_submission_media USING btree (project_id);


--
-- Name: ix_form_submission_media_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_submission_media_submission_id ON public.form_submission_media USING btree (submission_id);


--
-- Name: ix_form_versions_active_draft_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_form_versions_active_draft_slot ON public.form_versions USING btree (form_id, slot_index) WHERE ((kind = 'draft'::public.form_version_kind) AND (is_active = true));


--
-- Name: ix_form_versions_active_live; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_form_versions_active_live ON public.form_versions USING btree (form_id) WHERE ((kind = 'live'::public.form_version_kind) AND (is_active = true));


--
-- Name: ix_form_versions_form_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_versions_form_id ON public.form_versions USING btree (form_id);


--
-- Name: ix_forms_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_forms_slug ON public.forms USING btree (slug);


--
-- Name: ix_org_ai_action_costs_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_org_ai_action_costs_organization_id ON public.org_ai_action_costs USING btree (organization_id);


--
-- Name: ix_org_message_opt_outs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_org_message_opt_outs_org_id ON public.org_message_opt_outs USING btree (org_id);


--
-- Name: ix_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: ix_project_assets_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_assets_project_id ON public.project_assets USING btree (project_id);


--
-- Name: ix_project_attendance_records_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attendance_records_attendance_date ON public.project_attendance_records USING btree (attendance_date);


--
-- Name: ix_project_attendance_records_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attendance_records_project_id ON public.project_attendance_records USING btree (project_id);


--
-- Name: ix_project_attendance_records_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attendance_records_user_id ON public.project_attendance_records USING btree (user_id);


--
-- Name: ix_project_attention_hooks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attention_hooks_project_id ON public.project_attention_hooks USING btree (project_id);


--
-- Name: ix_project_attention_items_hook_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attention_items_hook_id ON public.project_attention_items USING btree (hook_id);


--
-- Name: ix_project_attention_items_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attention_items_kind ON public.project_attention_items USING btree (kind);


--
-- Name: ix_project_attention_items_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attention_items_project_id ON public.project_attention_items USING btree (project_id);


--
-- Name: ix_project_attention_items_source_automation_rule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attention_items_source_automation_rule_id ON public.project_attention_items USING btree (source_automation_rule_id);


--
-- Name: ix_project_attention_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_attention_items_status ON public.project_attention_items USING btree (status);


--
-- Name: ix_project_broadcast_deliveries_broadcast_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_broadcast_deliveries_broadcast_id ON public.project_broadcast_deliveries USING btree (broadcast_id);


--
-- Name: ix_project_broadcast_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_broadcast_deliveries_status ON public.project_broadcast_deliveries USING btree (status);


--
-- Name: ix_project_broadcasts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_broadcasts_created_at ON public.project_broadcasts USING btree (created_at);


--
-- Name: ix_project_broadcasts_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_broadcasts_org_id ON public.project_broadcasts USING btree (org_id);


--
-- Name: ix_project_broadcasts_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_broadcasts_project_id ON public.project_broadcasts USING btree (project_id);


--
-- Name: ix_project_broadcasts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_broadcasts_status ON public.project_broadcasts USING btree (status);


--
-- Name: ix_project_directory_items_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_directory_items_project_id ON public.project_directory_items USING btree (project_id);


--
-- Name: ix_project_directory_items_project_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_project_directory_items_project_sku ON public.project_directory_items USING btree (project_id, sku_code);


--
-- Name: ix_project_message_channels_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_message_channels_kind ON public.project_message_channels USING btree (kind);


--
-- Name: ix_project_message_channels_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_message_channels_team_id ON public.project_message_channels USING btree (team_id);


--
-- Name: ix_project_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_messages_channel_id ON public.project_messages USING btree (channel_id);


--
-- Name: ix_project_pinned_analytics_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_pinned_analytics_project_id ON public.project_pinned_analytics USING btree (project_id);


--
-- Name: ix_project_pinned_analytics_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_pinned_analytics_question_id ON public.project_pinned_analytics USING btree (question_id);


--
-- Name: ix_project_reports_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_reports_project_id ON public.project_reports USING btree (project_id);


--
-- Name: ix_project_tasks_automation_rule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_tasks_automation_rule_id ON public.project_tasks USING btree (automation_rule_id);


--
-- Name: ix_project_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_tasks_project_id ON public.project_tasks USING btree (project_id);


--
-- Name: ix_project_tasks_source_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_tasks_source_submission_id ON public.project_tasks USING btree (source_submission_id);


--
-- Name: ix_project_thread_messages_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_thread_messages_author_id ON public.project_messages USING btree (author_id);


--
-- Name: ix_project_thread_messages_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_thread_messages_project_id ON public.project_messages USING btree (project_id);


--
-- Name: ix_project_thread_notifications_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_thread_notifications_message_id ON public.project_message_notifications USING btree (message_id);


--
-- Name: ix_project_thread_notifications_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_thread_notifications_project_id ON public.project_message_notifications USING btree (project_id);


--
-- Name: ix_project_thread_notifications_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_thread_notifications_thread_id ON public.project_message_notifications USING btree (channel_id);


--
-- Name: ix_project_thread_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_thread_notifications_user_id ON public.project_message_notifications USING btree (user_id);


--
-- Name: ix_project_threads_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_threads_project_id ON public.project_message_channels USING btree (project_id);


--
-- Name: ix_saved_questions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_saved_questions_org_id ON public.saved_questions USING btree (org_id);


--
-- Name: ix_saved_questions_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_saved_questions_project_id ON public.saved_questions USING btree (project_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone);


--
-- Name: uq_project_message_channels_general; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_project_message_channels_general ON public.project_message_channels USING btree (project_id) WHERE (((kind)::text = 'general'::text) AND (archived_at IS NULL));


--
-- Name: uq_project_message_channels_team; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_project_message_channels_team ON public.project_message_channels USING btree (project_id, team_id) WHERE (((kind)::text = 'team'::text) AND (team_id IS NOT NULL) AND (archived_at IS NULL));


--
-- Name: ai_credit_ledger ai_credit_ledger_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credit_ledger
    ADD CONSTRAINT ai_credit_ledger_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_credit_ledger ai_credit_ledger_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credit_ledger
    ADD CONSTRAINT ai_credit_ledger_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_credit_ledger ai_credit_ledger_related_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credit_ledger
    ADD CONSTRAINT ai_credit_ledger_related_entry_id_fkey FOREIGN KEY (related_entry_id) REFERENCES public.ai_credit_ledger(id) ON DELETE SET NULL;


--
-- Name: analytics_dashboards analytics_dashboards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_dashboards
    ADD CONSTRAINT analytics_dashboards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: analytics_dashboards analytics_dashboards_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_dashboards
    ADD CONSTRAINT analytics_dashboards_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: analytics_dashboards analytics_dashboards_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_dashboards
    ADD CONSTRAINT analytics_dashboards_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: dashboard_cards dashboard_cards_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_cards
    ADD CONSTRAINT dashboard_cards_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.analytics_dashboards(id) ON DELETE CASCADE;


--
-- Name: dashboard_cards dashboard_cards_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_cards
    ADD CONSTRAINT dashboard_cards_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.saved_questions(id) ON DELETE CASCADE;


--
-- Name: project_access fk_project_access_role_template_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_access
    ADD CONSTRAINT fk_project_access_role_template_id FOREIGN KEY (role_template_id) REFERENCES public.project_role_templates(id);


--
-- Name: project_attendance_records fk_project_attendance_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attendance_records
    ADD CONSTRAINT fk_project_attendance_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_attendance_records fk_project_attendance_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attendance_records
    ADD CONSTRAINT fk_project_attendance_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_tasks fk_project_tasks_automation_rule_id_form_automation_rules; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT fk_project_tasks_automation_rule_id_form_automation_rules FOREIGN KEY (automation_rule_id) REFERENCES public.form_automation_rules(id) ON DELETE SET NULL;


--
-- Name: project_tasks fk_project_tasks_source_submission_id_submissions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT fk_project_tasks_source_submission_id_submissions FOREIGN KEY (source_submission_id) REFERENCES public.submissions(id);


--
-- Name: submissions fk_submissions_reviewed_by_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT fk_submissions_reviewed_by_users FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: form_automation_rules form_automation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_automation_rules
    ADD CONSTRAINT form_automation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: form_automation_rules form_automation_rules_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_automation_rules
    ADD CONSTRAINT form_automation_rules_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_dataset_fields form_dataset_fields_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_dataset_fields
    ADD CONSTRAINT form_dataset_fields_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.form_datasets(id);


--
-- Name: form_dataset_schema_versions form_dataset_schema_versions_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_dataset_schema_versions
    ADD CONSTRAINT form_dataset_schema_versions_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.form_datasets(id);


--
-- Name: form_dataset_schema_versions form_dataset_schema_versions_form_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_dataset_schema_versions
    ADD CONSTRAINT form_dataset_schema_versions_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES public.form_versions(id);


--
-- Name: form_datasets form_datasets_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_datasets
    ADD CONSTRAINT form_datasets_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id);


--
-- Name: form_submission_media form_submission_media_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submission_media
    ADD CONSTRAINT form_submission_media_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_submission_media form_submission_media_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submission_media
    ADD CONSTRAINT form_submission_media_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: form_submission_media form_submission_media_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submission_media
    ADD CONSTRAINT form_submission_media_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: form_versions form_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_versions
    ADD CONSTRAINT form_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: form_versions form_versions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_versions
    ADD CONSTRAINT form_versions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id);


--
-- Name: forms forms_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: invitations invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id);


--
-- Name: invitations invitations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: invitations invitations_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.users(id);


--
-- Name: invitations invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invitations invitations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: invitations invitations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: org_ai_action_costs org_ai_action_costs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_ai_action_costs
    ADD CONSTRAINT org_ai_action_costs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_ai_credit_balances org_ai_credit_balances_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_ai_credit_balances
    ADD CONSTRAINT org_ai_credit_balances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: org_members org_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: org_members org_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: org_message_opt_outs org_message_opt_outs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_message_opt_outs
    ADD CONSTRAINT org_message_opt_outs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: org_message_opt_outs org_message_opt_outs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_message_opt_outs
    ADD CONSTRAINT org_message_opt_outs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_role_assignments org_role_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_role_assignments
    ADD CONSTRAINT org_role_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: org_role_assignments org_role_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_role_assignments
    ADD CONSTRAINT org_role_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: org_role_assignments org_role_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_role_assignments
    ADD CONSTRAINT org_role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.org_roles(id);


--
-- Name: org_roles org_roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT org_roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: project_access project_access_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_access
    ADD CONSTRAINT project_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_assets project_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_assets project_assets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assets
    ADD CONSTRAINT project_assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_attention_hooks project_attention_hooks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_hooks
    ADD CONSTRAINT project_attention_hooks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_attention_items project_attention_items_dismissed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_dismissed_by_fkey FOREIGN KEY (dismissed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_attention_items project_attention_items_hook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_hook_id_fkey FOREIGN KEY (hook_id) REFERENCES public.project_attention_hooks(id) ON DELETE SET NULL;


--
-- Name: project_attention_items project_attention_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_attention_items project_attention_items_source_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_source_attendance_id_fkey FOREIGN KEY (source_attendance_id) REFERENCES public.project_attendance_records(id) ON DELETE SET NULL;


--
-- Name: project_attention_items project_attention_items_source_automation_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_source_automation_rule_id_fkey FOREIGN KEY (source_automation_rule_id) REFERENCES public.form_automation_rules(id) ON DELETE SET NULL;


--
-- Name: project_attention_items project_attention_items_source_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_source_submission_id_fkey FOREIGN KEY (source_submission_id) REFERENCES public.submissions(id) ON DELETE SET NULL;


--
-- Name: project_attention_items project_attention_items_source_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_source_task_id_fkey FOREIGN KEY (source_task_id) REFERENCES public.project_tasks(id) ON DELETE SET NULL;


--
-- Name: project_attention_items project_attention_items_source_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attention_items
    ADD CONSTRAINT project_attention_items_source_thread_id_fkey FOREIGN KEY (source_channel_id) REFERENCES public.project_message_channels(id) ON DELETE SET NULL;


--
-- Name: project_broadcast_deliveries project_broadcast_deliveries_broadcast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcast_deliveries
    ADD CONSTRAINT project_broadcast_deliveries_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.project_broadcasts(id) ON DELETE CASCADE;


--
-- Name: project_broadcast_deliveries project_broadcast_deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcast_deliveries
    ADD CONSTRAINT project_broadcast_deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_broadcasts project_broadcasts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcasts
    ADD CONSTRAINT project_broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_broadcasts project_broadcasts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcasts
    ADD CONSTRAINT project_broadcasts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_broadcasts project_broadcasts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_broadcasts
    ADD CONSTRAINT project_broadcasts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_directory_items project_catalog_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_directory_items
    ADD CONSTRAINT project_catalog_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_directory_items project_catalog_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_directory_items
    ADD CONSTRAINT project_catalog_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_pinned_analytics project_pinned_analytics_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pinned_analytics
    ADD CONSTRAINT project_pinned_analytics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_pinned_analytics project_pinned_analytics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pinned_analytics
    ADD CONSTRAINT project_pinned_analytics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_pinned_analytics project_pinned_analytics_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_pinned_analytics
    ADD CONSTRAINT project_pinned_analytics_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.saved_questions(id) ON DELETE CASCADE;


--
-- Name: project_reports project_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_reports
    ADD CONSTRAINT project_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_reports project_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_reports
    ADD CONSTRAINT project_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_role_templates project_role_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_role_templates
    ADD CONSTRAINT project_role_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: project_tasks project_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_messages project_thread_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_thread_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_messages project_thread_messages_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_thread_messages_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_messages project_thread_messages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_thread_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_messages project_thread_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_thread_messages_thread_id_fkey FOREIGN KEY (channel_id) REFERENCES public.project_message_channels(id) ON DELETE CASCADE;


--
-- Name: project_message_notifications project_thread_notifications_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_notifications
    ADD CONSTRAINT project_thread_notifications_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.project_messages(id) ON DELETE CASCADE;


--
-- Name: project_message_notifications project_thread_notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_notifications
    ADD CONSTRAINT project_thread_notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_message_notifications project_thread_notifications_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_notifications
    ADD CONSTRAINT project_thread_notifications_thread_id_fkey FOREIGN KEY (channel_id) REFERENCES public.project_message_channels(id) ON DELETE CASCADE;


--
-- Name: project_message_notifications project_thread_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_notifications
    ADD CONSTRAINT project_thread_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_message_channels project_threads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_channels
    ADD CONSTRAINT project_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_message_channels project_threads_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_channels
    ADD CONSTRAINT project_threads_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_message_channels project_threads_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_message_channels
    ADD CONSTRAINT project_threads_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: projects projects_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: saved_questions saved_questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_questions
    ADD CONSTRAINT saved_questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: saved_questions saved_questions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_questions
    ADD CONSTRAINT saved_questions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: saved_questions saved_questions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_questions
    ADD CONSTRAINT saved_questions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: section_templates section_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_templates
    ADD CONSTRAINT section_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: submissions submissions_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.form_datasets(id);


--
-- Name: submissions submissions_dataset_schema_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_dataset_schema_version_id_fkey FOREIGN KEY (dataset_schema_version_id) REFERENCES public.form_dataset_schema_versions(id);


--
-- Name: submissions submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id);


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: teams teams_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--


