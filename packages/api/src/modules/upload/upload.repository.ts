/**
 * The upload module has no persisted entity of its own — stored URLs are owned
 * by the referencing modules (application, profile). This class exists to satisfy
 * the 7-file module contract (AGENTS.md Clause 1) and is the natural home for
 * future upload audit logging without introducing a DB dependency.
 */
export class UploadRepository {}
