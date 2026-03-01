# Reusable JFrog Pipeline Templates

## Template 1: Frogbot PR Scan (Copy as-is)

**File**: `.azuredevops/frogbot-pr-scan.yml`

```yaml
# Frogbot PR Security Scan
# Scans pull requests for NEW security vulnerabilities

pool:  
  name: MapleForge-MDOP-Dev  
  demands:  
   - ImageOverride -equals linux

trigger: none

pr:
  branches:
    include:
      - main
      - develop

variables:
  - group: JFrog-Credentials
  - name: JF_GIT_PULL_REQUEST_ID
    value: $(System.PullRequest.PullRequestId)
  - name: JF_GIT_PROJECT
    value: $(System.TeamProject)
  - name: JF_GIT_REPO
    value: $(Build.Repository.Name)
  - name: JF_GIT_API_ENDPOINT
    value: $(System.CollectionUri)
  - name: JF_GIT_BASE_BRANCH
    value: $(System.PullRequest.TargetBranchName)
  - name: JF_GIT_OWNER
    value: $(System.TeamProject)
  - name: JF_GIT_PROVIDER
    value: 'azureRepos'
  - name: JF_URL
    value: $(JFROG_URL)
  - name: JF_ACCESS_TOKEN
    value: $(JFROG_ACCESS_TOKEN)
  - name: JF_GIT_TOKEN
    value: $(AZURE_TOKEN)

jobs:
  - job: FrogbotPRScan
    displayName: "Frogbot Scan Pull Request"
    steps:
      - checkout: self
        displayName: 'Checkout Source Code'
        persistCredentials: true

      - task: Bash@3
        displayName: 'Download Frogbot'
        env:
          JF_URL: $(JF_URL)
          JF_ACCESS_TOKEN: $(JF_ACCESS_TOKEN)
          JF_RELEASES_REPO: $(JFROG_REPO_FROGBOT)
        inputs:
          targetType: 'inline'
          script: |
            getFrogbotPath="${JF_URL}/artifactory/${JF_RELEASES_REPO}/Frogbot_linux"
            curl -fLg -H "Authorization: Bearer ${JF_ACCESS_TOKEN}" "$getFrogbotPath" -o Frogbot_linux
            
            if file Frogbot_linux | grep -q "gzip"; then
              tar -xzf Frogbot_linux
            else
              mv Frogbot_linux frogbot
            fi
            
            chmod +x frogbot

      - task: Bash@3
        displayName: 'Run Frogbot Scan'
        env:
          JF_URL: $(JF_URL)
          JF_ACCESS_TOKEN: $(JF_ACCESS_TOKEN)
          JF_GIT_TOKEN: $(JF_GIT_TOKEN)
          JF_GIT_PULL_REQUEST_ID: $(JF_GIT_PULL_REQUEST_ID)
          JF_GIT_PROJECT: $(JF_GIT_PROJECT)
          JF_GIT_REPO: $(JF_GIT_REPO)
          JF_GIT_API_ENDPOINT: $(JF_GIT_API_ENDPOINT)
          JF_GIT_BASE_BRANCH: $(JF_GIT_BASE_BRANCH)
          JF_GIT_OWNER: $(JF_GIT_OWNER)
          JF_GIT_PROVIDER: $(JF_GIT_PROVIDER)
          JF_SKIP_CONFIG_FILE: 'TRUE'
        inputs:
          targetType: 'inline'
          script: |
            ./frogbot spr
```

---

## Template 2: JFrog CLI Setup Snippet

**Use in**: Your `azure-pipelines.yml` build stage

```yaml
# Install and configure JFrog CLI
- bash: |
    curl -fL https://install-cli.jfrog.io | sh
  displayName: 'Install JFrog CLI'

- bash: |
    jf config add jfrog-server \
      --url=$(JFROG_URL) \
      --user=$(JFROG_USER) \
      --access-token=$(JFROG_ACCESS_TOKEN) \
      --interactive=false
  displayName: 'Configure JFrog CLI'
  env:
    JFROG_ACCESS_TOKEN: $(JFROG_ACCESS_TOKEN)
```

---

## Template 3: NPM Package Publishing

**Insert after**: `npm install` and `npm test`

```yaml
# Configure npm for JFrog (virtual repo)
- bash: |
    jf npmc --repo-resolve=$(JFROG_REPO_NPM) --repo-deploy=$(JFROG_REPO_NPM)
  displayName: 'Configure NPM for JFrog'

# Install dependencies via JFrog
- bash: |
    jf npm install --build-name=$(Build.DefinitionName) --build-number=$(Build.BuildNumber)
  displayName: 'Install Dependencies via JFrog'

# Publish npm package to JFrog
- bash: |
    jf npm publish --build-name=$(Build.DefinitionName) --build-number=$(Build.BuildNumber)
  displayName: 'Publish NPM Package to JFrog'

# Publish build metadata
- bash: |
    jf rt build-collect-env $(Build.DefinitionName) $(Build.BuildNumber)
    jf rt build-add-git $(Build.DefinitionName) $(Build.BuildNumber)
    jf rt build-publish $(Build.DefinitionName) $(Build.BuildNumber)
  displayName: 'Publish Build Info to JFrog'
```

---

## Template 4: Docker Image Publishing

**Insert after**: Docker build step

```yaml
# Push Docker image to JFrog
- bash: |
    REGISTRY_HOST=${JFROG_URL#https://}
    REGISTRY_HOST=${REGISTRY_HOST#http://}
    echo $(JFROG_ACCESS_TOKEN) | docker login ${REGISTRY_HOST} --username $(JFROG_USER) --password-stdin
  displayName: 'Docker Login to JFrog'
  env:
    JFROG_ACCESS_TOKEN: $(JFROG_ACCESS_TOKEN)

- bash: |
    REGISTRY_HOST=${JFROG_URL#https://}
    REGISTRY_HOST=${REGISTRY_HOST#http://}
    jf docker push ${REGISTRY_HOST}/$(JFROG_REPO_DOCKER)/$(IMAGE_NAME):$(Build.BuildNumber) \
      --build-name=$(Build.DefinitionName) \
      --build-number=$(Build.BuildNumber)
    jf docker push ${REGISTRY_HOST}/$(JFROG_REPO_DOCKER)/$(IMAGE_NAME):latest \
      --build-name=$(Build.DefinitionName) \
      --build-number=$(Build.BuildNumber)
  displayName: 'Push Docker Image to JFrog'

- bash: |
    jf rt build-publish $(Build.DefinitionName) $(Build.BuildNumber)
  displayName: 'Publish Docker Build Info'
```

---

## Template 5: Xray Build Scan

**Insert as**: Separate stage after build

```yaml
- stage: SecurityScan
  displayName: 'JFrog Security Scan'
  dependsOn: Build
  jobs:
    - job: XrayScan
      displayName: 'Xray Security Scan'
      steps:
        - checkout: none

        - bash: |
            curl -fL https://install-cli.jfrog.io | sh
          displayName: 'Install JFrog CLI'

        - bash: |
            jf config add jfrog-server \
              --url=$(JFROG_URL) \
              --user=$(JFROG_USER) \
              --access-token=$(JFROG_ACCESS_TOKEN) \
              --interactive=false
          displayName: 'Configure JFrog CLI'
          env:
            JFROG_ACCESS_TOKEN: $(JFROG_ACCESS_TOKEN)

        - bash: |
            jf bs $(Build.DefinitionName) $(Build.BuildNumber) --format=table
          displayName: 'Scan Build with Xray'
          continueOnError: true
```

---

## Template 6: SSL Certificate Configuration

**For projects using self-signed/internal CAs**

```yaml
# PoC Workaround (INSECURE - testing only)
- bash: |
    npm config set strict-ssl false
  displayName: 'Configure NPM SSL (PoC)'

# Production Solution (after installing CA on agent)
- bash: |
    CA_BUNDLE_PATH="/usr/local/share/ca-certificates/ca-bundle.crt"
    if [ -f "$CA_BUNDLE_PATH" ]; then
      npm config set cafile $CA_BUNDLE_PATH
    else
      echo "ERROR: CA bundle not found"
      exit 1
    fi
  displayName: 'Configure NPM SSL (Production)'
```

---

## Usage Instructions

### For New Projects:
1. Copy entire **Template 1** to `.azuredevops/frogbot-pr-scan.yml`
2. In your build pipeline, add:
   - **Template 2** (JFrog CLI setup)
  - **Template 3** (NPM) OR **Template 4** (Docker)
   - **Template 5** (Xray scanning - optional but recommended)

### For Existing Projects:
1. Add **Template 1** for PR scanning
2. Insert relevant snippets (**Template 2-5**) into existing build pipeline

### Variables Required:
Create variable group `JFrog-Credentials` with:
- `JFROG_URL`: https://your-jfrog-instance.com
- `JFROG_ACCESS_TOKEN`: Your JFrog access token
- `JFROG_USER`: Username that created the token
- `AZURE_TOKEN`: Azure DevOps PAT with PR comment permissions
- `JFROG_REPO_NPM`: npm repository name (e.g., `mj-npm-virtual`)
- `JFROG_REPO_DOCKER`: Docker repository name (e.g., `mj-docker-virtual`)
- `JFROG_REPO_FROGBOT`: Frogbot binary repository (e.g., `mj-frongbotrepo`)

---

## Complete Example

See `azure-pipelines.yml` in this repository for a fully working example integrating all templates.
