_WEIGHTS = (10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19)


def normalise_abn(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def is_valid_abn_checksum(value: str) -> bool:
    """ABN modulus-89 checksum. A valid checksum is NOT verification of the business."""
    digits = normalise_abn(value)
    if len(digits) != 11:
        return False
    nums = [int(d) for d in digits]
    nums[0] -= 1
    return sum(n * w for n, w in zip(nums, _WEIGHTS, strict=True)) % 89 == 0
