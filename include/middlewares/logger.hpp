#ifndef ECHONEXUS_LOGGER_HPP
#define ECHONEXUS_LOGGER_HPP

#include <boost/asio/awaitable.hpp>

#include <handler.hpp>
#include <types/request.hpp>
#include <types/response.hpp>

namespace echo::middlewares {

    auto logger(std::shared_ptr<type::request>, std::optional<next_fn_t>) -> boost::asio::awaitable<type::response>;

} // namespace echo::middlewares

#endif // ECHONEXUS_LOGGER_HPP
