output "topic_ids" {
  description = "Map of topic names to IDs"
  value = {
    for name, topic in google_pubsub_topic.topics : name => topic.id
  }
}

output "dead_letter_topic_id" {
  description = "Dead letter topic ID"
  value       = google_pubsub_topic.dead_letter.id
}

output "subscription_ids" {
  description = "Map of subscription names to IDs"
  value = {
    for name, sub in google_pubsub_subscription.subs : name => sub.id
  }
}
