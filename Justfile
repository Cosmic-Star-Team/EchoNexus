[arg("compiler", long="compiler", help="C++ compiler command or path")]
[arg("debug_flag", long="debug", value="debug", help="Use the debug profile (default)")]
[arg("release", long="release", value="release", help="Use the release profile")]
configure compiler="" release="" debug_flag="":
    cmake -S . -B build/{{ if compiler != "" { replace(replace(replace(replace(replace(compiler, "/", "_"), "\\", "_"), " ", "_"), "+", "x"), ":", "_") } else { "system" } }}-{{ if release != "" { "release" } else if debug_flag != "" { "debug" } else { "debug" } }} -G Ninja -DCMAKE_BUILD_TYPE={{ if release != "" { "Release" } else if debug_flag != "" { "Debug" } else { "Debug" } }}{{ if compiler != "" { " \"-DCMAKE_CXX_COMPILER=" + compiler + "\"" } else { "" } }}

[arg("compiler", long="compiler", help="C++ compiler command or path")]
[arg("debug_flag", long="debug", value="debug", help="Use the debug profile (default)")]
[arg("release", long="release", value="release", help="Use the release profile")]
build compiler="" release="" debug_flag="": (configure compiler release debug_flag)
    cmake --build build/{{ if compiler != "" { replace(replace(replace(replace(replace(compiler, "/", "_"), "\\", "_"), " ", "_"), "+", "x"), ":", "_") } else { "system" } }}-{{ if release != "" { "release" } else if debug_flag != "" { "debug" } else { "debug" } }}

[arg("compiler", long="compiler", help="C++ compiler command or path")]
[arg("debug_flag", long="debug", value="debug", help="Use the debug profile (default)")]
[arg("release", long="release", value="release", help="Use the release profile")]
test compiler="" release="" debug_flag="": (build compiler release debug_flag)
    ctest --test-dir build/{{ if compiler != "" { replace(replace(replace(replace(replace(compiler, "/", "_"), "\\", "_"), " ", "_"), "+", "x"), ":", "_") } else { "system" } }}-{{ if release != "" { "release" } else if debug_flag != "" { "debug" } else { "debug" } }} --output-on-failure

[arg("compiler", long="compiler", help="C++ compiler command or path")]
[arg("debug_flag", long="debug", value="debug", help="Use the debug profile (default)")]
[arg("release", long="release", value="release", help="Use the release profile")]
run compiler="" release="" debug_flag="": (configure compiler release debug_flag)
    cmake --build build/{{ if compiler != "" { replace(replace(replace(replace(replace(compiler, "/", "_"), "\\", "_"), " ", "_"), "+", "x"), ":", "_") } else { "system" } }}-{{ if release != "" { "release" } else if debug_flag != "" { "debug" } else { "debug" } }} --target example
    cmake -E chdir build/{{ if compiler != "" { replace(replace(replace(replace(replace(compiler, "/", "_"), "\\", "_"), " ", "_"), "+", "x"), ":", "_") } else { "system" } }}-{{ if release != "" { "release" } else if debug_flag != "" { "debug" } else { "debug" } }} example/example{{ if os_family() == "windows" { ".exe" } else { "" } }}
