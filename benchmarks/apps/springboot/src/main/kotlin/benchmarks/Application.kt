package benchmarks

import org.apache.catalina.connector.Connector
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.context.annotation.Bean

@SpringBootApplication
class Application {
    @Bean
    fun tomcatCustomizer(): WebServerFactoryCustomizer<TomcatServletWebServerFactory> {
        return WebServerFactoryCustomizer { factory ->
            val port = (
                System.getProperty("BENCHMARK_PORT")
                    ?: System.getenv("BENCHMARK_PORT")
                    ?: "8080"
                ).toInt()
            val workers = (
                System.getProperty("BENCHMARK_WORKERS")
                    ?: System.getenv("BENCHMARK_WORKERS")
                    ?: "1"
                ).toInt()

            factory.port = port
            factory.addConnectorCustomizers({ connector: Connector ->
                connector.protocolHandler.executor = null
                connector.setProperty("maxThreads", workers.toString())
                connector.setProperty("minSpareThreads", workers.toString())
            })
        }
    }
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
