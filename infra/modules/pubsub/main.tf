# ============================================================
# Pub/Sub Module — Topics + Subscriptions
# Mapped from docs/architecture/event-flows.md
# ============================================================

locals {
  topics = {
    "customer.created"        = { subscriptions = [] }
    "customer.updated"        = { subscriptions = [] }
    "sales-order.submitted"   = { subscriptions = [] }
    "sales-order.confirmed"   = { subscriptions = [] }
    "sales-order.cancelled"   = { subscriptions = ["inventory-service"] }
    "sales-order.fulfilled"   = { subscriptions = ["inventory-service"] }
    "product.created"         = { subscriptions = ["inventory-service"] }
    "goods.received"          = { subscriptions = ["inventory-service"] }
  }

  # Flatten subscriptions for for_each
  subscriptions = flatten([
    for topic_name, topic in local.topics : [
      for sub in topic.subscriptions : {
        key        = "${sub}.${topic_name}"
        topic_name = topic_name
        subscriber = sub
      }
    ]
  ])
}

# --- Topics ---

resource "google_pubsub_topic" "topics" {
  for_each = local.topics

  name    = each.key
  project = var.project_id

  message_retention_duration = "604800s"
}

# Dead Letter Topic
resource "google_pubsub_topic" "dead_letter" {
  name    = "dead-letter"
  project = var.project_id

  message_retention_duration = "604800s"
}

# --- Subscriptions ---

resource "google_pubsub_subscription" "subs" {
  for_each = { for s in local.subscriptions : s.key => s }

  name    = each.key
  project = var.project_id
  topic   = google_pubsub_topic.topics[each.value.topic_name].id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# Dead Letter Subscription
resource "google_pubsub_subscription" "dead_letter_sub" {
  name    = "dead-letter-sub"
  project = var.project_id
  topic   = google_pubsub_topic.dead_letter.id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"
}
