package com.pggateway.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI metadata. UI at /swagger-ui.html, spec at /v3/api-docs (source for the SDK + portal). */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI pgGatewayOpenApi() {
        return new OpenAPI().info(new Info()
                .title("PGGateway API")
                .version("0.1.0")
                .description("SNAP-native transaction ledger + Fraud Detection System. "
                        + "Endpoints: ingest (mirror), transactions, fraud/AML alerts, and the "
                        + "dynamic FDS rule engine. Cara terhubung lihat docs/developer-integration-plan."));
    }
}
