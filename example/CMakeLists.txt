cmake_minimum_required(VERSION 3.23)

project(EchoNexusExample CXX)

add_executable(example src/main.cpp)

target_link_libraries(example PRIVATE EchoNexus)
