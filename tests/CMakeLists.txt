find_package(Catch2 3 CONFIG REQUIRED)

add_executable(
    echonexus_unit_tests
    unit/test.test.cpp
)

target_link_libraries(
    echonexus_unit_tests
    PRIVATE
        EchoNexus
        Catch2::Catch2WithMain
)

target_include_directories(
    echonexus_unit_tests
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

target_compile_features(echonexus_unit_tests PRIVATE cxx_std_23)

add_test(NAME echonexus.unit COMMAND echonexus_unit_tests)
set_tests_properties(echonexus.unit PROPERTIES LABELS "unit")

if(NOT ECHONEXUS_DISABLE_BEAST)
    add_executable(
        echonexus_integration_tests
        integration/server_smoke.test.cpp
    )

    target_link_libraries(
        echonexus_integration_tests
        PRIVATE
            EchoNexus
            Catch2::Catch2WithMain
    )

    target_include_directories(
        echonexus_integration_tests
        PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}
    )

    target_compile_features(echonexus_integration_tests PRIVATE cxx_std_23)

    add_test(NAME echonexus.integration COMMAND echonexus_integration_tests)
    set_tests_properties(echonexus.integration PROPERTIES LABELS "integration")
endif()
