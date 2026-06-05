def get_recommendations(
    cpu,
    memory,
    disk,
    running_containers,
    stopped_containers
):

    recommendations = []

    if cpu > 80:
        recommendations.append(
            "High CPU detected. Check running processes."
        )

    if memory > 80:
        recommendations.append(
            "Memory usage is high. Investigate memory leaks."
        )

    if disk > 90:
        recommendations.append(
            "Disk usage critical. Free storage immediately."
        )

    if stopped_containers > 5:
        recommendations.append(
            f"{stopped_containers} stopped containers detected. Consider cleaning unused containers."
        )
    
    if stopped_containers >= 5:
        recommendations.append(
            "Run docker container prune to remove unused stopped containers."
        )

    if (
        cpu < 50 and
        memory < 50 and
        disk < 80
    ):
        recommendations.append(
            "Infrastructure operating normally."
        )

    return recommendations