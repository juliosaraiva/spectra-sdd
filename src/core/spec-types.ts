import { z } from "zod";

// ─── Shared Primitives ───────────────────────────────────────────────────────

export const SpecId = z.string().regex(/^(feat|impl|test|migration):[a-z0-9-]+$/);
export const ConstitutionRef = z.string().regex(/^const:v\d+\.\d+$/);
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/);
export const ContentHash = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const Iso8601 = z.string().datetime();
export const ConcernNamespace = z.string().regex(/^[a-z]+(\.[a-z]+)*$/);

export type SpecId = z.infer<typeof SpecId>;
export type ContentHash = z.infer<typeof ContentHash>;

// ─── Spec Status ─────────────────────────────────────────────────────────────

export const SpecStatus = z.enum([
  "draft",
  "review",
  "active",
  "deprecated",
  "archived",
]);
export type SpecStatus = z.infer<typeof SpecStatus>;

// ─── Phase ───────────────────────────────────────────────────────────────────

export const Phase = z.enum([
  "specify",
  "design",
  "test-design",
  "implement",
  "reconcile",
]);
export type Phase = z.infer<typeof Phase>;

export const PHASE_ORDER: Phase[] = [
  "specify",
  "design",
  "test-design",
  "implement",
  "reconcile",
];

// ─── Acceptance Criterion ────────────────────────────────────────────────────

export const AcceptanceCriterionSchema = z.object({
  id: z.string().regex(/^AC-\d{3}$/),
  title: z.string().min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.array(z.string().min(1)).min(1),
  non_negotiable: z.boolean().default(false),
  constitution_constraints: z.array(z.string()).optional(),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

// ─── Interface Schema ────────────────────────────────────────────────────────

export const InterfaceFieldSchema: z.ZodType<Record<string, unknown>> = z
  .record(z.unknown())
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Interface schema must not be empty",
  });

export const InterfaceInputSchema = z.object({
  name: z.string().min(1),
  schema: InterfaceFieldSchema,
  constraints: z.array(z.string()).optional(),
});

export const InterfaceOutputSchema = z.object({
  name: z.string().min(1),
  schema: InterfaceFieldSchema,
});

export const EventSchema = z.object({
  name: z.string().min(1),
  schema_ref: z.string().optional(),
});

export const InterfacesSchema = z.object({
  inputs: z.array(InterfaceInputSchema).default([]),
  outputs: z.array(InterfaceOutputSchema).default([]),
  events_emitted: z.array(EventSchema).default([]),
  events_consumed: z.array(EventSchema).default([]),
});

// ─── Non-Functional Requirements ─────────────────────────────────────────────

export const NonFunctionalSchema = z.object({
  performance: z.array(z.string()).default([]),
  security: z.array(z.string()).default([]),
  observability: z.array(z.string()).default([]),
  scalability: z.array(z.string()).default([]),
});

// ─── Spectra Metadata (common header) ────────────────────────────────────────

export const SpectraMetaSchema = z.object({
  version: z.string().default("1.0"),
  type: z.enum(["constitution", "feature", "impl", "test", "migration"]),
  id: z.string().min(1),
  semver: SemVer,
  status: SpecStatus,
  created: z.string(),
  updated: z.string(),
  authors: z.array(z.string()).min(1),
  reviewers: z.array(z.string()).default([]),
  constitution_ref: z.string().optional(),
});

// ─── Tier 0: Constitution ────────────────────────────────────────────────────

export const ConstraintSchema = z.object({
  id: z.string().regex(/^[A-Z]+-\d{3}$/),
  title: z.string().min(1),
  description: z.string().min(1),
  domain: z.array(z.string()).min(1),
  enforcement: z.enum(["MUST", "SHOULD", "MAY"]),
  rationale: z.string().optional(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const ConstitutionSchema = z.object({
  spectra: z.object({
    version: z.string().default("1.0"),
    type: z.literal("constitution"),
    semver: SemVer,
    updated: z.string(),
    stewards: z.array(z.string()).min(1),
  }),
  vocabulary: z.array(z.string()).min(1),
  constraints: z.array(ConstraintSchema).min(1),
});
export type Constitution = z.infer<typeof ConstitutionSchema>;

// ─── Tier 1: Feature Spec ────────────────────────────────────────────────────

export const FeatureSpecSchema = z.object({
  spectra: SpectraMetaSchema.extend({
    type: z.literal("feature"),
  }),
  identity: z.object({
    title: z.string().min(1),
    domain: z.array(z.string()).min(1),
    tags: z.array(z.string()).default([]),
    summary: z.string().min(1),
  }),
  interfaces: InterfacesSchema.optional(),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).min(1),
  non_functional: NonFunctionalSchema.optional(),
  dependencies: z
    .object({
      feature_refs: z.array(z.string()).default([]),
      schema_refs: z.array(z.string()).default([]),
    })
    .optional(),
  hash: z
    .object({
      content_hash: ContentHash,
      signed_at: z.string(),
      signed_by: z.string(),
    })
    .optional(),
});
export type FeatureSpec = z.infer<typeof FeatureSpecSchema>;

// ─── Tier 2: Implementation Spec ─────────────────────────────────────────────

export const ImplSpecSchema = z.object({
  spectra: SpectraMetaSchema.extend({
    type: z.literal("impl"),
    feature_ref: z.string().min(1),
    concern: ConcernNamespace,
  }),
  design: z.record(z.unknown()),
});
export type ImplSpec = z.infer<typeof ImplSpecSchema>;

// ─── Tier 3: Test Spec ───────────────────────────────────────────────────────

export const TestCaseSchema = z.object({
  id: z.string().regex(/^TC-\d{3}$/),
  ac_ref: z.string().regex(/^AC-\d{3}$/),
  title: z.string().min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.array(z.string().min(1)).min(1),
  fixtures: z.array(z.string()).default([]),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const TestSpecSchema = z.object({
  spectra: SpectraMetaSchema.extend({
    type: z.literal("test"),
    feature_ref: z.string().min(1),
  }),
  test_cases: z.array(TestCaseSchema).min(1),
});
export type TestSpec = z.infer<typeof TestSpecSchema>;

// ─── Tier 4: Migration Spec ─────────────────────────────────────────────────

export const MigrationSpecSchema = z.object({
  spectra: SpectraMetaSchema.extend({
    type: z.literal("migration"),
    feature_ref: z.string().optional(),
  }),
  current_state: z.object({
    description: z.string().min(1),
    files: z.array(z.string()).default([]),
    behavior: z.array(z.string()).default([]),
  }),
  desired_state: z.object({
    description: z.string().min(1),
    feature_ref: z.string().optional(),
  }),
  strategy: z.enum(["additive", "breaking", "deprecation"]),
  rollback: z.string().optional(),
  validation_checkpoints: z.array(z.string()).default([]),
});
export type MigrationSpec = z.infer<typeof MigrationSpecSchema>;

// ─── Gate File ───────────────────────────────────────────────────────────────

export const GateStatus = z.enum(["pending", "approved", "rejected", "expired"]);

export const GateSchema = z.object({
  gate: z.object({
    spec_id: z.string().min(1),
    spec_semver: SemVer,
    spec_hash: ContentHash,
    phase: Phase,
    status: GateStatus,
  }),
  approval: z
    .object({
      approved_by: z.string().min(1),
      approved_at: z.string(),
      method: z.enum(["cli", "github-pr", "linear-issue", "api"]),
      comment: z.string().optional(),
    })
    .optional(),
  artifacts_reviewed: z
    .array(
      z.object({
        path: z.string(),
        hash: ContentHash,
      })
    )
    .default([]),
  expiry: z
    .object({
      expires_if_spec_changes: z.boolean().default(true),
      manual_expiry: z.string().nullable().default(null),
    })
    .default({}),
});
export type Gate = z.infer<typeof GateSchema>;

// ─── Config ──────────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  spectra: z.object({
    version: z.string().default("1.0"),
    project_id: z.string().min(1),
  }),
  ai: z
    .object({
      adapter: z.string().default("none"),
      primary_agent: z.string().default("none"),
    })
    .default({}),
  spec: z
    .object({
      id_prefix: z.string().default("feat"),
      default_status: SpecStatus.default("draft"),
    })
    .default({}),
  git: z
    .object({
      gate_branch_protection: z.boolean().default(false),
      trace_commit_hook: z.boolean().default(false),
    })
    .default({}),
  hooks: z.record(z.array(z.record(z.unknown()))).default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

// ─── Traceability Matrix ─────────────────────────────────────────────────────

export const TraceArtifactSchema = z.object({
  path: z.string(),
  hash: ContentHash,
  concern: z.string().optional(),
  impl_ref: z.string().optional(),
  generation_id: z.string().optional(),
  type: z.enum(["source", "test"]).default("source"),
});

export const ACCoverageSchema = z.object({
  covered: z.boolean(),
  test_ids: z.array(z.string()),
});

export const TraceEntrySchema = z.object({
  hash: ContentHash,
  status: SpecStatus,
  authorized_artifacts: z.array(TraceArtifactSchema).default([]),
  ac_coverage: z.record(ACCoverageSchema).default({}),
  gates: z.record(GateStatus).default({}),
});

export const TraceMatrixSchema = z.object({
  version: z.string().default("1.0"),
  updated_at: z.string(),
  specs: z.record(TraceEntrySchema).default({}),
});
export type TraceMatrix = z.infer<typeof TraceMatrixSchema>;

// ─── Progressive Disclosure Index ────────────────────────────────────────────

export const IndexEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: SpecStatus,
  semver: SemVer,
  domain: z.array(z.string()),
  summary: z.string(),
  ac_count: z.number(),
  impl_count: z.number(),
  test_count: z.number(),
  hash: ContentHash,
  file: z.string(),
});
export type IndexEntry = z.infer<typeof IndexEntrySchema>;

export const SpecIndexSchema = z.object({
  spectra_index: z.object({
    version: z.string().default("1.0"),
    last_updated: z.string(),
  }),
  features: z.array(IndexEntrySchema).default([]),
});
export type SpecIndex = z.infer<typeof SpecIndexSchema>;

// ─── Generation Lock ─────────────────────────────────────────────────────────

export const LockEntrySchema = z.object({
  template_id: z.string(),
  template_version: z.string(),
  template_hash: ContentHash,
  input_spec_hash: ContentHash,
  model: z.string(),
  model_params: z.record(z.unknown()),
  output_hash: ContentHash,
  generated_at: z.string(),
  generation_id: z.string(),
});
export type LockEntry = z.infer<typeof LockEntrySchema>;

export const GenerateLockSchema = z.record(LockEntrySchema);
export type GenerateLock = z.infer<typeof GenerateLockSchema>;

// ─── Union type for any spec ─────────────────────────────────────────────────

export type AnySpec = FeatureSpec | ImplSpec | TestSpec | MigrationSpec;
