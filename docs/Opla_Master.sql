/*
 Navicat Premium Dump SQL

 Source Server         : local_Post
 Source Server Type    : PostgreSQL
 Source Server Version : 180003 (180003)
 Source Host           : localhost:5432
 Source Catalog        : opla_db
 Source Schema         : public

 Target Server Type    : PostgreSQL
 Target Server Version : 180003 (180003)
 File Encoding         : 65001

 Date: 03/03/2026 19:37:28
*/


-- ----------------------------
-- Type structure for accessor_type
-- ----------------------------
DROP TYPE IF EXISTS "public"."accessor_type";
CREATE TYPE "public"."accessor_type" AS ENUM (
  'user',
  'team'
);

-- ----------------------------
-- Type structure for accessortype
-- ----------------------------
DROP TYPE IF EXISTS "public"."accessortype";
CREATE TYPE "public"."accessortype" AS ENUM (
  'USER',
  'TEAM'
);

-- ----------------------------
-- Type structure for form_status
-- ----------------------------
DROP TYPE IF EXISTS "public"."form_status";
CREATE TYPE "public"."form_status" AS ENUM (
  'draft',
  'live',
  'archived'
);

-- ----------------------------
-- Type structure for formstatus
-- ----------------------------
DROP TYPE IF EXISTS "public"."formstatus";
CREATE TYPE "public"."formstatus" AS ENUM (
  'DRAFT',
  'LIVE',
  'ARCHIVED'
);

-- ----------------------------
-- Type structure for global_role
-- ----------------------------
DROP TYPE IF EXISTS "public"."global_role";
CREATE TYPE "public"."global_role" AS ENUM (
  'admin',
  'member'
);

-- ----------------------------
-- Type structure for invitation_status
-- ----------------------------
DROP TYPE IF EXISTS "public"."invitation_status";
CREATE TYPE "public"."invitation_status" AS ENUM (
  'pending',
  'accepted'
);

-- ----------------------------
-- Type structure for project_role
-- ----------------------------
DROP TYPE IF EXISTS "public"."project_role";
CREATE TYPE "public"."project_role" AS ENUM (
  'collector',
  'analyst',
  'editor'
);

-- ----------------------------
-- Type structure for projectrole
-- ----------------------------
DROP TYPE IF EXISTS "public"."projectrole";
CREATE TYPE "public"."projectrole" AS ENUM (
  'COLLECTOR',
  'ANALYST',
  'EDITOR'
);

-- ----------------------------
-- Table structure for forms
-- ----------------------------
DROP TABLE IF EXISTS "public"."forms";
CREATE TABLE "public"."forms" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "title" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "slug" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "blueprint_draft" jsonb,
  "blueprint_live" jsonb,
  "version" int4 NOT NULL DEFAULT 1,
  "is_public" bool NOT NULL DEFAULT false,
  "status" "public"."form_status" NOT NULL DEFAULT 'draft'::form_status,
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for org_members
-- ----------------------------
DROP TABLE IF EXISTS "public"."org_members";
CREATE TABLE "public"."org_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "global_role" "public"."global_role" NOT NULL DEFAULT 'member'::global_role,
  "invited_by" uuid,
  "invitation_status" "public"."invitation_status" NOT NULL DEFAULT 'pending'::invitation_status,
  "joined_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for org_role_assignments
-- ----------------------------
DROP TABLE IF EXISTS "public"."org_role_assignments";
CREATE TABLE "public"."org_role_assignments" (
  "id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "accessor_id" uuid NOT NULL,
  "accessor_type" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "assigned_by" uuid,
  "created_at" timestamp(6) NOT NULL
)
;

-- ----------------------------
-- Table structure for org_roles
-- ----------------------------
DROP TABLE IF EXISTS "public"."org_roles";
CREATE TABLE "public"."org_roles" (
  "id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "slug" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "description" varchar COLLATE "pg_catalog"."default",
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "priority" int4 NOT NULL DEFAULT 50,
  "is_system" bool NOT NULL,
  "created_at" timestamp(6) NOT NULL,
  "updated_at" timestamp(6) NOT NULL
)
;

-- ----------------------------
-- Table structure for organizations
-- ----------------------------
DROP TABLE IF EXISTS "public"."organizations";
CREATE TABLE "public"."organizations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "slug" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "owner_id" uuid NOT NULL,
  "logo_url" varchar COLLATE "pg_catalog"."default",
  "primary_color" varchar COLLATE "pg_catalog"."default" NOT NULL DEFAULT '#6366f1'::character varying,
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for project_access
-- ----------------------------
DROP TABLE IF EXISTS "public"."project_access";
CREATE TABLE "public"."project_access" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  "accessor_id" uuid NOT NULL,
  "accessor_type" "public"."accessor_type" NOT NULL,
  "role" "public"."project_role" NOT NULL
)
;

-- ----------------------------
-- Table structure for projects
-- ----------------------------
DROP TABLE IF EXISTS "public"."projects";
CREATE TABLE "public"."projects" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for submissions
-- ----------------------------
DROP TABLE IF EXISTS "public"."submissions";
CREATE TABLE "public"."submissions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "form_id" uuid NOT NULL,
  "user_id" uuid,
  "data" jsonb NOT NULL,
  "metadata_json" jsonb,
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for team_members
-- ----------------------------
DROP TABLE IF EXISTS "public"."team_members";
CREATE TABLE "public"."team_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "added_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for teams
-- ----------------------------
DROP TABLE IF EXISTS "public"."teams";
CREATE TABLE "public"."teams" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS "public"."users";
CREATE TABLE "public"."users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "phone" varchar COLLATE "pg_catalog"."default",
  "email" varchar COLLATE "pg_catalog"."default",
  "password_hash" varchar COLLATE "pg_catalog"."default",
  "full_name" varchar COLLATE "pg_catalog"."default" NOT NULL,
  "is_platform_admin" bool NOT NULL DEFAULT false,
  "is_active" bool NOT NULL DEFAULT true,
  "created_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP
)
;

-- ----------------------------
-- Indexes structure for table forms
-- ----------------------------
CREATE INDEX "ix_forms_slug" ON "public"."forms" USING btree (
  "slug" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table forms
-- ----------------------------
ALTER TABLE "public"."forms" ADD CONSTRAINT "forms_slug_key" UNIQUE ("slug");

-- ----------------------------
-- Primary Key structure for table forms
-- ----------------------------
ALTER TABLE "public"."forms" ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Uniques structure for table org_members
-- ----------------------------
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_user_id_org_id_key" UNIQUE ("user_id", "org_id");

-- ----------------------------
-- Primary Key structure for table org_members
-- ----------------------------
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Uniques structure for table org_role_assignments
-- ----------------------------
ALTER TABLE "public"."org_role_assignments" ADD CONSTRAINT "_org_accessor_uc" UNIQUE ("org_id", "accessor_id", "accessor_type");

-- ----------------------------
-- Primary Key structure for table org_role_assignments
-- ----------------------------
ALTER TABLE "public"."org_role_assignments" ADD CONSTRAINT "org_role_assignments_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Uniques structure for table org_roles
-- ----------------------------
ALTER TABLE "public"."org_roles" ADD CONSTRAINT "_org_role_slug_uc" UNIQUE ("org_id", "slug");

-- ----------------------------
-- Primary Key structure for table org_roles
-- ----------------------------
ALTER TABLE "public"."org_roles" ADD CONSTRAINT "org_roles_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table organizations
-- ----------------------------
CREATE INDEX "ix_organizations_slug" ON "public"."organizations" USING btree (
  "slug" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table organizations
-- ----------------------------
ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");

-- ----------------------------
-- Primary Key structure for table organizations
-- ----------------------------
ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Uniques structure for table project_access
-- ----------------------------
ALTER TABLE "public"."project_access" ADD CONSTRAINT "project_access_project_id_accessor_id_accessor_type_key" UNIQUE ("project_id", "accessor_id", "accessor_type");

-- ----------------------------
-- Primary Key structure for table project_access
-- ----------------------------
ALTER TABLE "public"."project_access" ADD CONSTRAINT "project_access_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table projects
-- ----------------------------
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table submissions
-- ----------------------------
CREATE INDEX "ix_submissions_form_id" ON "public"."submissions" USING btree (
  "form_id" "pg_catalog"."uuid_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table submissions
-- ----------------------------
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Uniques structure for table team_members
-- ----------------------------
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");

-- ----------------------------
-- Primary Key structure for table team_members
-- ----------------------------
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table teams
-- ----------------------------
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table users
-- ----------------------------
CREATE INDEX "ix_users_email" ON "public"."users" USING btree (
  "email" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "ix_users_phone" ON "public"."users" USING btree (
  "phone" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table users
-- ----------------------------
ALTER TABLE "public"."users" ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");
ALTER TABLE "public"."users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- ----------------------------
-- Primary Key structure for table users
-- ----------------------------
ALTER TABLE "public"."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Foreign Keys structure for table forms
-- ----------------------------
ALTER TABLE "public"."forms" ADD CONSTRAINT "forms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table org_members
-- ----------------------------
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table org_role_assignments
-- ----------------------------
ALTER TABLE "public"."org_role_assignments" ADD CONSTRAINT "org_role_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."org_role_assignments" ADD CONSTRAINT "org_role_assignments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."org_role_assignments" ADD CONSTRAINT "org_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."org_roles" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table org_roles
-- ----------------------------
ALTER TABLE "public"."org_roles" ADD CONSTRAINT "org_roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table organizations
-- ----------------------------
ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table project_access
-- ----------------------------
ALTER TABLE "public"."project_access" ADD CONSTRAINT "project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table projects
-- ----------------------------
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table submissions
-- ----------------------------
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table team_members
-- ----------------------------
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table teams
-- ----------------------------
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
