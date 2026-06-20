def top_k_routes(counts: dict, k: int) -> list:
    if not counts or k <= 0:
        return []

    items = [[name, cnt] for name, cnt in counts.items()]
    n = len(items)
    k = min(k, n)
    used = [False] * n
    result = []

    for _ in range(k):
        best_idx, best_val = -1, -1
        for i in range(n):
            if not used[i] and items[i][1] > best_val:
                best_val = items[i][1]
                best_idx = i
        if best_idx == -1:
            break
        used[best_idx] = True
        result.append((items[best_idx][0], items[best_idx][1]))

    return result

