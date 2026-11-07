# TFLint 0.64.0 Configuration for Hotel Premium
config {
  call_module_type = "local"
  force = false
  disabled_by_default = false
}

rule "terraform_deprecated_interpolation" {
  enabled = true
}

rule "terraform_unused_declarations" {
  enabled = true
}
