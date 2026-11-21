CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."delivery_mode" AS ENUM('parcel', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."enrolment_status" AS ENUM('active', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_status" AS ENUM('not_started', 'list_received', 'packing', 'dispatched', 'ready_for_pickup', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."instalment_status" AS ENUM('pending', 'submitted', 'paid');--> statement-breakpoint
CREATE TYPE "public"."notif_kind" AS ENUM('payments', 'dues', 'offers', 'delivery', 'general');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('upi', 'bank', 'cash');--> statement-breakpoint
CREATE TYPE "public"."pay_status" AS ENUM('submitted', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" varchar(60) NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_id" varchar(64),
	"meta" jsonb,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'staff' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"phone" varchar(15),
	"created_by" uuid,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrol_no" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"scheme_id" uuid NOT NULL,
	"monthly" integer NOT NULL,
	"total_instalments" integer NOT NULL,
	"bonus_amount" integer NOT NULL,
	"status" "enrolment_status" DEFAULT 'active' NOT NULL,
	"bonus_override" varchar(8),
	"fulfilment_status" "fulfilment_status" DEFAULT 'not_started' NOT NULL,
	"fulfilment_note" text,
	"tracking_ref" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instalments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"no" integer NOT NULL,
	"month" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" integer NOT NULL,
	"status" "instalment_status" DEFAULT 'pending' NOT NULL,
	"paid_on" date,
	"on_time" boolean
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notif_kind" NOT NULL,
	"title_ta" text NOT NULL,
	"title_en" text NOT NULL,
	"body_ta" text NOT NULL,
	"body_en" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mobile" varchar(15) NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" varchar(24) NOT NULL,
	"user_id" uuid NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"instalment_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" "pay_method" NOT NULL,
	"utr" varchar(40),
	"status" "pay_status" DEFAULT 'submitted' NOT NULL,
	"paid_on" date NOT NULL,
	"reject_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"received_by" uuid,
	"note" text,
	"idempotency_key" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"monthly" integer NOT NULL,
	"gift_ta" text DEFAULT '' NOT NULL,
	"gift_en" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ta" text NOT NULL,
	"name_en" text NOT NULL,
	"period_ta" text NOT NULL,
	"period_en" text NOT NULL,
	"start_date" date NOT NULL,
	"instalments" integer DEFAULT 9 NOT NULL,
	"bonus_instalments" integer DEFAULT 1 NOT NULL,
	"due_day" integer DEFAULT 10 NOT NULL,
	"choose_by" date NOT NULL,
	"parcel_from" date NOT NULL,
	"pickup_by" date NOT NULL,
	"join_until" date,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"referral_target" integer DEFAULT 5 NOT NULL,
	"referral_reward_ta" text DEFAULT '' NOT NULL,
	"referral_reward_en" text DEFAULT '' NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_no" serial NOT NULL,
	"mobile" varchar(15) NOT NULL,
	"name" varchar(120),
	"lang" varchar(2) DEFAULT 'ta' NOT NULL,
	"delivery_mode" "delivery_mode" DEFAULT 'parcel' NOT NULL,
	"pickup_store" varchar(20) DEFAULT 'main' NOT NULL,
	"address" varchar(250),
	"city" varchar(80),
	"pincode" varchar(6),
	"referral_code" varchar(12),
	"referred_by" uuid,
	"blocked" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_admins_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_enrolment_id_enrolments_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrolment_id_enrolments_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_instalment_id_instalments_id_fk" FOREIGN KEY ("instalment_id") REFERENCES "public"."instalments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_admins_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_admin_idx" ON "activity_logs" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_uq" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "enrol_no_uq" ON "enrolments" USING btree ("enrol_no");--> statement-breakpoint
CREATE INDEX "enrol_user_idx" ON "enrolments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enrol_status_idx" ON "enrolments" USING btree ("status","fulfilment_status");--> statement-breakpoint
CREATE INDEX "enrol_plan_idx" ON "enrolments" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inst_enrol_no_uq" ON "instalments" USING btree ("enrolment_id","no");--> statement-breakpoint
CREATE INDEX "inst_due_idx" ON "instalments" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "otps_mobile_idx" ON "otps" USING btree ("mobile","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_ref_uq" ON "payments" USING btree ("ref");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_idem_uq" ON "payments" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "pay_status_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pay_enrol_idx" ON "payments" USING btree ("enrolment_id");--> statement-breakpoint
CREATE INDEX "pay_inst_idx" ON "payments" USING btree ("instalment_id");--> statement-breakpoint
CREATE INDEX "pay_user_idx" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_scheme_n_uq" ON "plans" USING btree ("scheme_id","n");--> statement-breakpoint
CREATE INDEX "schemes_open_idx" ON "schemes" USING btree ("open");--> statement-breakpoint
CREATE UNIQUE INDEX "users_mobile_uq" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE UNIQUE INDEX "users_customer_no_uq" ON "users" USING btree ("customer_no");--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_uq" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "users_created_idx" ON "users" USING btree ("created_at");