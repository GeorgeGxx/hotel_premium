{{/*
Expand the name of the chart.
*/}}
{{- define "hotel-premium.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "hotel-premium.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "hotel-premium.labels" -}}
helm.sh/chart: {{ include "hotel-premium.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hotel-premium
{{- end }}

{{/*
Resolve container image supporting global.imageRegistry, global.imagePrefix, and global.imageTag overrides from CI/CD
*/}}
{{- define "hotel-premium.serviceImage" -}}
{{- $svc := .svc -}}
{{- $global := .global -}}
{{- $imgName := printf "hotel-%s" $svc.name -}}
{{- if eq $svc.name "hotel-frontend" -}}
{{- $imgName = "hotel-frontend" -}}
{{- end -}}
{{- $reg := ($global.imageRegistry | default "docker.io") -}}
{{- $pref := ($global.imagePrefix | default "georgegxx") -}}
{{- $tag := (toString ($global.imageTag | default "1.0.0")) -}}
{{- if or (ne $reg "docker.io") (ne $pref "georgegxx") (ne $tag "1.0.0") -}}
{{- if and $reg (ne $reg "") (ne $reg "docker.io") -}}
{{- printf "%s/%s/%s:%s" $reg $pref $imgName $tag -}}
{{- else -}}
{{- printf "%s/%s:%s" $pref $imgName $tag -}}
{{- end -}}
{{- else -}}
{{- $svc.image -}}
{{- end -}}
{{- end }}
