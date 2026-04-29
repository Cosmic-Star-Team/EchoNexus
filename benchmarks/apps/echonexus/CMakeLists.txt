cmake_minimum_required(VERSION 3.25)

get_filename_component(ECHONEXUS_REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)

option(
    ECHONEXUS_AUTO_SETUP_VCPKG
    "Auto clone/bootstrap vcpkg into .vcpkg when needed."
    ON
)
# This benchmark app is configured as its own top-level entrypoint, so it must
# resolve dependencies before project() and before adding EchoNexus as a subdir.
set(VCPKG_MANIFEST_DIR "${ECHONEXUS_REPO_ROOT}" CACHE PATH "EchoNexus vcpkg manifest root" FORCE)
set(ECHONEXUS_VCPKG_PROJECT_ROOT "${ECHONEXUS_REPO_ROOT}")
set(ECHONEXUS_VCPKG_IS_TOP_LEVEL ON)
include("${ECHONEXUS_REPO_ROOT}/cmake/EchoNexusVcpkg.cmake")

project(echonexus-benchmark LANGUAGES CXX)

set(ECHONEXUS_BUILD_EXAMPLES OFF CACHE BOOL "Disable examples for the benchmark app" FORCE)
set(ECHONEXUS_BUILD_TESTS OFF CACHE BOOL "Disable tests for the benchmark app" FORCE)

add_subdirectory("${ECHONEXUS_REPO_ROOT}" "${CMAKE_CURRENT_BINARY_DIR}/echonexus" EXCLUDE_FROM_ALL)

if(ECHONEXUS_DISABLE_BEAST)
    message(
        FATAL_ERROR
        "echonexus_benchmark requires Boost.Beast. "
        "Set ECHONEXUS_DISABLE_BEAST=OFF."
    )
endif()

add_executable(echonexus_benchmark src/main.cpp)

target_link_libraries(echonexus_benchmark PRIVATE EchoNexus::EchoNexus)
target_compile_features(echonexus_benchmark PRIVATE cxx_std_23)

set_target_properties(
    echonexus_benchmark
    PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/benchmarks/apps/echonexus"
)

foreach(ECHONEXUS_CONFIG Debug Release RelWithDebInfo MinSizeRel)
    string(TOUPPER "${ECHONEXUS_CONFIG}" ECHONEXUS_CONFIG_UPPER)
    set_target_properties(
        echonexus_benchmark
        PROPERTIES
            "RUNTIME_OUTPUT_DIRECTORY_${ECHONEXUS_CONFIG_UPPER}" "${CMAKE_CURRENT_BINARY_DIR}/benchmarks/apps/echonexus"
    )
endforeach()
