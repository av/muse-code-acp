/**
 * What this adapter does with every view event the pinned SDK folds.
 *
 * The w2/m1 defect was invisible because `approval/updated` was folded, never
 * routed, and never polled: there was no place where "nobody consumes this"
 * could be noticed. These tables are that place. Every method the SDK can fold
 * is classified exactly once, with the consumer or the reason it is dropped, and
 * a test fails when the installed SDK folds a method neither table names.
 *
 * Being listed as ignored is a recorded decision, not an accident — each entry
 * says which milestone owns it.
 */
/** Methods the adapter consumes, mapped to the code that consumes them. */
export declare const HANDLED_VIEW_EVENTS: Readonly<Record<string, string>>;
/** Methods the adapter deliberately drops, with the owner of that decision. */
export declare const IGNORED_VIEW_EVENTS: Readonly<Record<string, string>>;
/** Every classified method. A method may appear in exactly one table. */
export declare function classifiedViewEvents(): string[];
/**
 * Methods the installed SDK folds that this adapter has never classified.
 * A non-empty result means the SDK moved and the tables need a decision.
 */
export declare function unclassifiedViewEvents(folded: readonly string[]): string[];
/** Item families are classified independently of the envelope events above. */
export declare const ITEM_KIND_CONSUMERS: Readonly<Record<string, string>>;
//# sourceMappingURL=muse-view-events.d.ts.map