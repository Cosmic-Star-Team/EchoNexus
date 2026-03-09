#ifndef ECHONEXUS_TYPES_COMMON_HPP
#define ECHONEXUS_TYPES_COMMON_HPP

#include <any>
#include <string>
#include <unordered_map>

namespace echo::type {
    using map_t     = std::unordered_map<std::string, std::string>;
    using context_t = std::unordered_map<std::string, std::any>;
} // namespace echo::type

#endif // ECHONEXUS_TYPES_COMMON_HPP
