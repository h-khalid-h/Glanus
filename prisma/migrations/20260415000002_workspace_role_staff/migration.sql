-- Migration: 20260415000002_workspace_role_staff
-- Additive-only: adds STAFF as a new value to the WorkspaceRole enum.
-- Existing rows are unaffected; STAFF sits between ADMIN and MEMBER.

ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'STAFF' AFTER 'ADMIN';
