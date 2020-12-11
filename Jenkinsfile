def allowedBranches4AutoDeloy = ['master']
def nullBranchOption = "Select branch name or git tag"
def nullDockerImageTag = "Select Docker image tag to deploy"
def runNormalBuild = false
def runCreateDockerImage = false
def runDeployment = false


pipeline {

    agent any
    environment {
        BRANCHES = sh (
            script: "git branch -r --sort=committerdate | grep -v 'origin/HEAD' | sed 's#origin/##g'",
            returnStdout: true
        ).trim()

        GIT_TAGS = sh (
            script: "git tag",
            returnStdout: true
        ).trim()

        // TODO: call DTR and initialize image_tags with available image tags
        DOCKER_IMAGE_TAGS = '1.0\n2.0\n3.0'
    }
    stages {

        stage('print vars') {
            steps {
                echo "env.BRANCHES          ${env.BRANCHES}"
                echo "env.GIT_TAGS          ${env.GIT_TAGS}"
                echo "env.DOCKER_IMAGE_TAGS ${env.DOCKER_IMAGE_TAGS}"
                echo "env.BUILD_TAG       ${env.BUILD_TAG}"
                echo "env.BUILD_URL     ${env.BUILD_URL}"
                echo "BUILD NUMBER          ${env.BUILD_NUMBER}"
            }
        }

        stage('check build cause') {
            steps {
                script {
                    def buildCause = currentBuild.getBuildCauses()[0]
                    echo "Cause: ${buildCause}\n"                    
                }
            }
        }

        stage('set/print vars when triggered by svc') {
            when{
                triggeredBy "GitHubPush"
            }
            steps {
                echo "env.BRANCHES          ${env.BRANCHES}"
                echo "env.GIT_TAGS          ${env.GIT_TAGS}"
                echo "env.DOCKER_IMAGE_TAGS ${env.DOCKER_IMAGE_TAGS}"
                echo "env.BUILD_TAG       ${env.BUILD_TAG}"
                echo "env.BUILD_URL     ${env.BUILD_URL}"
                echo "BUILD NUMBER          ${env.BUILD_NUMBER}"
                script {
                    runNormalBuild = true
                    def commit = checkout scm
                    // we set BRANCH_NAME to make when { branch } syntax work without multibranch job
                    env.BRANCH_NAME = commit.GIT_BRANCH.replace('origin/', '')                
                    runCreateDockerImage = env.BRANCH_NAME in allowedBranches4AutoDeloy
                    runDeployment = env.BRANCH_NAME in allowedBranches4AutoDeloy
                }
            }
        }

        stage('User to customize the run') {
            when {
                beforeInput true
                anyOf {
                    triggeredBy 'User'
                }
            }

            steps {
                script {
                    def BRANCHES = sh (
                        script: "git branch -r --sort=committerdate | grep -v 'origin/HEAD' | sed 's#origin/##g'",
                        returnStdout: true
                    ).trim()

                    def GIT_TAGS = sh (
                        script: "git tag",
                        returnStdout: true
                    ).trim()

                    // TODO: call DTR and initialize image_tags with available image tags
                    def DOCKER_IMAGE_TAGS = '1.0\n2.0\n3.0'

                    def userInput = input message: 'Select what to build and/or deploy',
                        parameters: [
                            choice(
                                choices: "${nullBranchOption}\n${BRANCHES}\n${GIT_TAGS}",
                                description: 'Branch name or tag to build (and deploy if below is NOT ticked).\n Docker image tag will be ignored if branch/tag is selected.', 
                                name: 'SELECTED_REVISION_TO_BUILD'
                            ),
                            booleanParam(
                                defaultValue: false, 
                                description: "Tick to only build docker image out of code (No deploy).", 
                                name: 'BUILD_ONLY'
                            ),
                            choice(
                                choices: "${nullDockerImageTag}\n${DOCKER_IMAGE_TAGS}",
                                description: 'Docker image tag to deploy (mutually exclusive to branch/tag options)', 
                                name: 'SELECTED_DOCKER_IMAGE_TAG'
                            )                    
                        ]

                    env.SELECTED_REVISION_TO_BUILD = userInput['SELECTED_REVISION_TO_BUILD']
                    env.BUILD_ONLY = userInput['BUILD_ONLY']
                    env.SELECTED_DOCKER_IMAGE_TAG = userInput['SELECTED_DOCKER_IMAGE_TAG']

                    runNormalBuild = ! (userInput['SELECTED_REVISION_TO_BUILD'] == nullBranchOption &&
                        userInput['SELECTED_DOCKER_IMAGE_TAG'] != nullDockerImageTag)
                    runCreateDockerImage = runNormalBuild
                    runDeployment = (! userInput['BUILD_ONLY'] && userInput['SELECTED_REVISION_TO_BUILD'] != nullBranchOption) ||
                        (userInput['SELECTED_REVISION_TO_BUILD'] == nullBranchOption && userInput['SELECTED_DOCKER_IMAGE_TAG'] != nullDockerImageTag)

                    if (userInput['SELECTED_REVISION_TO_BUILD'] != nullBranchOption) {
                        env.BRANCH_NAME = env.SELECTED_REVISION_TO_BUILD                
                    }
                }

                echo "env.SELECTED_REVISION_TO_BUILD ${env.SELECTED_REVISION_TO_BUILD}"
                echo "env.BUILD_ONLY ${env.BUILD_ONLY}"
                echo "env.SELECTED_DOCKER_IMAGE_TAG ${env.SELECTED_DOCKER_IMAGE_TAG}"
            }

        }

        stage('Check user inputs in previous stage') {
            steps {
                echo "SELECTED_REVISION_TO_BUILD: ${env.SELECTED_REVISION_TO_BUILD}"
                echo "BUILD_ONLY: ${env.BUILD_ONLY}"
                echo "SELECTED_DOCKER_IMAGE_TAG: ${env.SELECTED_DOCKER_IMAGE_TAG}"

                echo "runNormalBuild: ${runNormalBuild}"
                echo "runCreateDockerImage: ${runCreateDockerImage}"
                echo "runDeployment: ${runDeployment}"
            }
        }

        stage('Clone sources') {
            when {
                expression { runNormalBuild == true }
            }
            steps {
                echo "list branches"
                sh "git branch"
                echo "switch to ${env.BRANCH_NAME}"
                sh "git checkout ${env.BRANCH_NAME}"
            }
        }

        stage('Install dependencies') {
            when {
                expression { runNormalBuild == true }
            }
            steps{
                sh 'npm install'
            }
        }

        stage('Test code') {
            when {
                expression { runNormalBuild == true }
            }
            steps {
                echo "npm test"
            }
        }

        stage('Build Docker Image and Publish to DTR') {
            when {
                expression { runCreateDockerImage == true }
            }
            steps {
                echo "Built ${env.SELECTED_REVISION_TO_BUILD} and published to DTR."
                echo "Set dockerImageTag according to this build (${env.BUILD_TAG})"
            }
        }    

        stage('Deploy Docker Image') {
            when {
                expression { runDeployment == true }
            }
            steps {
                echo "Deployed image ${env.BUILD_TAG}"
            }
        }
    }
}
