export declare const PROVIDER_EXTENSION = "muse/provider";
export declare const RECOMMENDATION_EXTENSION = "muse/configRecommendations";
export interface ClientProvider {
    providerId: "meta";
    baseUrl: string;
    apiKey: string;
}
/** An explicit endpoint is never reconstructed from a model name or credential. */
export declare function parseClientProvider(value: unknown): ClientProvider;
export declare function providerBinding(provider: ClientProvider): string;
//# sourceMappingURL=client-provider.d.ts.map