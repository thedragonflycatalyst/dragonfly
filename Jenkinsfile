// Jenkins is the required CI gate for Dragonfly Coach.
// Create a Jenkins Pipeline job pointing at this repository/Jenkinsfile.
// Do not use GitHub Actions for build approval.
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
  }
  stages {
    stage('Install dependencies') {
      steps {
        script {
          if (isUnix()) { sh 'cd app && npm ci' }
          else { bat 'cd app && npm ci' }
        }
      }
    }
    stage('Typecheck') {
      steps {
        script {
          if (isUnix()) { sh 'cd app && npm run typecheck' }
          else { bat 'cd app && npm run typecheck' }
        }
      }
    }
    stage('Unit tests') {
      steps {
        script {
          if (isUnix()) { sh 'cd app && npm test' }
          else { bat 'cd app && npm test' }
        }
      }
    }
    stage('Web build') {
      steps {
        script {
          if (isUnix()) { sh 'cd app && npm run build:web' }
          else { bat 'cd app && npm run build:web' }
        }
      }
    }
  }
  post {
    success { echo 'Dragonfly Coach Jenkins checks passed; Android acceptance and DB migration remain separate release gates.' }
    failure { echo 'Dragonfly Coach Jenkins checks failed. Do not merge or deploy.' }
  }
}
