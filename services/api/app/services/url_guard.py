"""SSRF guard for any future network connector. Fail closed."""

import ipaddress
import socket
from urllib.parse import urlsplit

from app.errors import ApiError


def _blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def assert_safe_url(url: str, allowed_hosts: set[str], *, resolve: bool = True) -> None:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host or parts.username or parts.password:
        raise ApiError(400, "unsafe_url", "Only plain https URLs are allowed")
    if host not in allowed_hosts:
        raise ApiError(400, "unsafe_url", "Host is not on the approved source list")
    try:
        literals = [ipaddress.ip_address(host)]
    except ValueError:
        literals = []
        if resolve:
            try:
                infos = socket.getaddrinfo(host, parts.port or 443, proto=socket.IPPROTO_TCP)
            except socket.gaierror as exc:
                raise ApiError(400, "unsafe_url", "Host did not resolve") from exc
            literals = [ipaddress.ip_address(i[4][0]) for i in infos]
    if any(_blocked(ip) for ip in literals):
        raise ApiError(400, "unsafe_url", "Host resolves to a non-public address")
