include_guard(GLOBAL)

if(NOT DEFINED ECHONEXUS_VCPKG_PROJECT_ROOT)
    message(FATAL_ERROR "ECHONEXUS_VCPKG_PROJECT_ROOT must be defined before including EchoNexusVcpkg.cmake")
endif()

if(NOT DEFINED ECHONEXUS_VCPKG_IS_TOP_LEVEL)
    message(FATAL_ERROR "ECHONEXUS_VCPKG_IS_TOP_LEVEL must be defined before including EchoNexusVcpkg.cmake")
endif()

set(ECHONEXUS_LOCAL_VCPKG_DIR "${ECHONEXUS_VCPKG_PROJECT_ROOT}/.vcpkg")
set(
    ECHONEXUS_LOCAL_VCPKG_TOOLCHAIN
    "${ECHONEXUS_LOCAL_VCPKG_DIR}/scripts/buildsystems/vcpkg.cmake"
)
set(
    ECHONEXUS_ENV_VCPKG_TOOLCHAIN
    "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
)

if(DEFINED CMAKE_TOOLCHAIN_FILE AND EXISTS "${CMAKE_TOOLCHAIN_FILE}")
    message(
        STATUS
        "Using explicit CMAKE_TOOLCHAIN_FILE: ${CMAKE_TOOLCHAIN_FILE}"
    )
elseif(NOT ECHONEXUS_VCPKG_IS_TOP_LEVEL)
    message(
        STATUS
        "EchoNexus is being configured as a subproject; skipping vcpkg auto-setup. "
        "Configure the parent project's dependencies before its first project() call."
    )
elseif(EXISTS "${ECHONEXUS_ENV_VCPKG_TOOLCHAIN}")
    set(
        CMAKE_TOOLCHAIN_FILE
        "${ECHONEXUS_ENV_VCPKG_TOOLCHAIN}"
        CACHE FILEPATH "vcpkg toolchain file" FORCE
    )
    message(STATUS "Using vcpkg from VCPKG_ROOT: ${CMAKE_TOOLCHAIN_FILE}")
elseif(ECHONEXUS_VCPKG_IS_TOP_LEVEL AND ECHONEXUS_AUTO_SETUP_VCPKG)
    find_program(ECHONEXUS_GIT_EXECUTABLE git)
    if(NOT ECHONEXUS_GIT_EXECUTABLE)
        message(
            FATAL_ERROR
            "git is required to auto-setup vcpkg. "
            "Install git or provide CMAKE_TOOLCHAIN_FILE."
        )
    endif()

    if(NOT EXISTS "${ECHONEXUS_LOCAL_VCPKG_DIR}/.git")
        message(STATUS "Cloning vcpkg to ${ECHONEXUS_LOCAL_VCPKG_DIR}")
        execute_process(
            COMMAND "${ECHONEXUS_GIT_EXECUTABLE}"
                clone
                https://github.com/microsoft/vcpkg.git
                "${ECHONEXUS_LOCAL_VCPKG_DIR}"
            RESULT_VARIABLE ECHONEXUS_VCPKG_CLONE_RESULT
        )
        if(NOT ECHONEXUS_VCPKG_CLONE_RESULT EQUAL 0)
            message(
                FATAL_ERROR
                "Failed to clone vcpkg "
                "(exit code: ${ECHONEXUS_VCPKG_CLONE_RESULT})."
            )
        endif()
    endif()

    message(STATUS "Bootstrapping local vcpkg in ${ECHONEXUS_LOCAL_VCPKG_DIR}")
    if(WIN32)
        execute_process(
            COMMAND cmd /c
                "${ECHONEXUS_LOCAL_VCPKG_DIR}/bootstrap-vcpkg.bat"
                -disableMetrics
            WORKING_DIRECTORY "${ECHONEXUS_LOCAL_VCPKG_DIR}"
            RESULT_VARIABLE ECHONEXUS_VCPKG_BOOTSTRAP_RESULT
        )
    else()
        execute_process(
            COMMAND "${ECHONEXUS_LOCAL_VCPKG_DIR}/bootstrap-vcpkg.sh"
                -disableMetrics
            WORKING_DIRECTORY "${ECHONEXUS_LOCAL_VCPKG_DIR}"
            RESULT_VARIABLE ECHONEXUS_VCPKG_BOOTSTRAP_RESULT
        )
    endif()

    if(NOT ECHONEXUS_VCPKG_BOOTSTRAP_RESULT EQUAL 0)
        message(
            FATAL_ERROR
            "Failed to bootstrap vcpkg "
            "(exit code: ${ECHONEXUS_VCPKG_BOOTSTRAP_RESULT})."
        )
    endif()

    if(NOT EXISTS "${ECHONEXUS_LOCAL_VCPKG_TOOLCHAIN}")
        message(
            FATAL_ERROR
            "vcpkg toolchain not found after bootstrap: "
            "${ECHONEXUS_LOCAL_VCPKG_TOOLCHAIN}"
        )
    endif()

    set(
        CMAKE_TOOLCHAIN_FILE
        "${ECHONEXUS_LOCAL_VCPKG_TOOLCHAIN}"
        CACHE FILEPATH "vcpkg toolchain file" FORCE
    )
    message(STATUS "Using local vcpkg toolchain: ${CMAKE_TOOLCHAIN_FILE}")
elseif(ECHONEXUS_VCPKG_IS_TOP_LEVEL)
    message(FATAL_ERROR
        "No valid vcpkg toolchain file found.\n"
        "Set CMAKE_TOOLCHAIN_FILE, set VCPKG_ROOT, "
        "or keep ECHONEXUS_AUTO_SETUP_VCPKG=ON."
    )
endif()
