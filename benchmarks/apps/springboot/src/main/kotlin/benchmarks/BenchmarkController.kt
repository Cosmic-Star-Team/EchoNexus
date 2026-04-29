package benchmarks

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestAttribute
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime

data class HelloPayload(val message: String, val ok: Boolean)
data class TimePayload(val localTime: String, val unixMs: Long, val timezoneOffsetMinutes: Int)
data class ProfilePayload(val id: String, val scope: String, val active: Boolean)

@RestController
class BenchmarkController {
    @GetMapping("/healthz")
    fun healthz(): String = "ok"

    @GetMapping("/plaintext")
    fun plaintext(): String = "Hello, World!"

    @GetMapping("/json")
    fun json(): HelloPayload = HelloPayload("Hello, World!", true)

    @GetMapping("/time_json")
    fun timeJson(): TimePayload {
        val now = OffsetDateTime.now()
        return TimePayload(
            localTime = now.toString(),
            unixMs = now.toInstant().toEpochMilli(),
            timezoneOffsetMinutes = now.offset.totalSeconds / 60,
        )
    }

    @GetMapping("/api/v1/users/{id}/profile")
    fun profile(
        @PathVariable id: String,
        @RequestAttribute(name = "scope", required = false) scope: String?,
    ): ProfilePayload {
        return ProfilePayload(id, scope ?: "missing", true)
    }
}
