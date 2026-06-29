def calculate_reliability(cpu, memory, disk):

    score = 100

    if cpu > 80:
        score -= 30
    elif cpu > 50:
        score -= 15

    if memory > 80:
        score -= 30
    elif memory > 60:
        score -= 15

    if disk > 90:
        score -= 40
    elif disk > 70:
        score -= 20

    return max(score, 0)


def get_health_status(score):

    if score >= 80:
        return "HEALTHY"

    elif score >= 50:
        return "WARNING"

    return "CRITICAL"