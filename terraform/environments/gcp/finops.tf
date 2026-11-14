data "google_project" "finops" {
  project_id = var.project_id
}

resource "google_billing_budget" "monthly_cost" {
  count           = var.enable_monthly_cost_budget ? 1 : 0
  billing_account = var.billing_account_id
  display_name    = "${local.name}-${local.env}-monthly-cost"

  budget_filter {
    projects = ["projects/${data.google_project.finops.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = floor(lookup(var.monthly_cost_budget_usd, local.env, 0))
      nanos         = floor((lookup(var.monthly_cost_budget_usd, local.env, 0) - floor(lookup(var.monthly_cost_budget_usd, local.env, 0))) * 1000000000)
    }
  }

  threshold_rules {
    threshold_percent = 0.8
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  lifecycle {
    precondition {
      condition     = trimspace(var.billing_account_id) != ""
      error_message = "Set billing_account_id before enabling the GCP billing budget."
    }
    precondition {
      condition     = lookup(var.monthly_cost_budget_usd, local.env, 0) > 0
      error_message = "Set monthly_cost_budget_usd for the selected workspace before enabling the GCP budget."
    }
  }
}
