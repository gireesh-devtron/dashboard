import React, { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useLocation, useRouteMatch, useHistory } from 'react-router'
import { NavLink, Link, Route, Switch } from 'react-router-dom'
import {
    URLS,
    getAppComposeURL,
    APP_COMPOSE_STAGE,
    isCIPipelineCreated,
    ViewType,
    isCDPipelineCreated,
} from '../../../../config'
import {
    ErrorBoundary,
    Progressing,
    usePrevious,
    showError,
    DeleteDialog,
    ConfirmationDialog,
    useAsync,
    ErrorScreenManager,
} from '../../../common'
import { getAppConfigStatus, getAppOtherEnvironment, getWorkflowList } from '../../../../services/service'
import { deleteApp } from './appConfig.service'
import { ReactComponent as Next } from '../../../../assets/icons/ic-arrow-forward.svg'
import { ReactComponent as Dropdown } from '../../../../assets/icons/ic-chevron-down.svg'
import { ReactComponent as Lock } from '../../../../assets/icons/ic-locked.svg'
import { ReactComponent as Help } from '../../../../assets/icons/ic-help.svg'
import warn from '../../../../assets/icons/ic-warning.svg'
import { toast } from 'react-toastify'
import './appConfig.scss'
import { DOCUMENTATION } from '../../../../config'
import AppConfigurationCheckBox from './AppConfigurationCheckBox'
import InfoColourBar from '../../../common/infocolourBar/InfoColourbar'
import {
    AppComposeRouterProps,
    AppConfigNavigationProps,
    AppConfigState,
    AppStageUnlockedType,
    EnvironmentOverrideRouteProps,
    EnvironmentOverridesProps,
    NextButtonProps,
    STAGE_NAME,
} from './appConfig.type'

const MaterialList = lazy(() => import('../../../material/MaterialList'))
const CIConfig = lazy(() => import('../../../ciConfig/CIConfig'))
const DeploymentConfig = lazy(() => import('../../../deploymentConfig/DeploymentConfig'))
const ConfigMap = lazy(() => import('../../../configMaps/ConfigMap'))
const Secret = lazy(() => import('../../../secrets/Secret'))
const WorkflowEdit = lazy(() => import('../../../workflowEditor/workflowEditor'))
const EnvironmentOverride = lazy(() => import('../../../EnvironmentOverride/EnvironmentOverride'))

//stage: last configured stage
function isUnlocked(stage: string): AppStageUnlockedType {
    return {
        material:
            stage === STAGE_NAME.APP ||
            stage === STAGE_NAME.GIT_MATERIAL ||
            stage === STAGE_NAME.CI_CONFIG ||
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
        dockerBuildConfig:
            stage === STAGE_NAME.GIT_MATERIAL ||
            stage === STAGE_NAME.CI_CONFIG ||
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
        deploymentTemplate:
            stage === STAGE_NAME.CI_CONFIG ||
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
        workflowEditor:
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
        configmap:
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
        secret:
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
        envOverride:
            stage === STAGE_NAME.CI_PIPELINE ||
            stage === STAGE_NAME.DEPLOYMENT_TEMPLATE ||
            stage === STAGE_NAME.CD_PIPELINE ||
            stage === STAGE_NAME.CHART_ENV_CONFIG,
    }
}

function getCompletedStep(isUnlocked: AppStageUnlockedType): number {
    if (isUnlocked.workflowEditor) {
        return 3
    } else if (isUnlocked.deploymentTemplate) {
        return 2
    } else if (isUnlocked.dockerBuildConfig) {
        return 1
    } else {
        return 0
    }
}

function getNavItems(isUnlocked: AppStageUnlockedType, appId: string): { navItems } {
    const completedSteps = getCompletedStep(isUnlocked)
    const completedPercent = completedSteps * 25
    let navItems = [
        {
            title: 'Git Repository',
            href: `/app/${appId}/edit/materials`,
            stage: STAGE_NAME.GIT_MATERIAL,
            isLocked: !isUnlocked.material,
            supportDocumentURL: DOCUMENTATION.APP_CREATE_MATERIAL,
            flowCompletionPercent: completedPercent,
            currentStep: completedSteps,
        },
        {
            title: 'Docker Build Config',
            href: `/app/${appId}/edit/docker-build-config`,
            stage: STAGE_NAME.CI_CONFIG,
            isLocked: !isUnlocked.dockerBuildConfig,
            supportDocumentURL: DOCUMENTATION.APP_CREATE_CI_CONFIG,
            flowCompletionPercent: completedPercent,
            currentStep: completedSteps,
        },
        {
            title: 'Base Deployment Template',
            href: `/app/${appId}/edit/deployment-template`,
            stage: STAGE_NAME.DEPLOYMENT_TEMPLATE,
            isLocked: !isUnlocked.deploymentTemplate,
            supportDocumentURL: DOCUMENTATION.APP_DEPLOYMENT_TEMPLATE,
            flowCompletionPercent: completedPercent,
            currentStep: completedSteps,
        },
        {
            title: 'Workflow Editor',
            href: `/app/${appId}/edit/workflow`,
            stage: 'WORKFLOW',
            isLocked: !isUnlocked.workflowEditor,
            supportDocumentURL: DOCUMENTATION.APP_CREATE_WORKFLOW,
            flowCompletionPercent: completedPercent,
            currentStep: completedSteps,
        },
        {
            title: 'ConfigMaps',
            href: `/app/${appId}/edit/configmap`,
            stage: 'CONFIGMAP',
            isLocked: !isUnlocked.configmap,
            supportDocumentURL: DOCUMENTATION.APP_CREATE_CONFIG_MAP,
            flowCompletionPercent: completedPercent,
            currentStep: completedSteps,
        },
        {
            title: 'Secrets',
            href: `/app/${appId}/edit/secrets`,
            stage: 'SECRETS',
            isLocked: !isUnlocked.secret,
            supportDocumentURL: DOCUMENTATION.APP_CREATE_SECRET,
            flowCompletionPercent: completedPercent,
            currentStep: completedSteps,
        },
        {
            title: 'Environment Override',
            href: `/app/${appId}/edit/env-override`,
            stage: 'ENV_OVERRIDE',
            isLocked: !isUnlocked.envOverride,
        },
    ]

    return { navItems }
}

export default function AppConfig() {
    const { appId } = useParams<{ appId: string }>()
    const match = useRouteMatch()
    const location = useLocation()
    const history = useHistory()
    const [environments, setEnvironments] = useState([])

    const [state, setState] = useState<AppConfigState>({
        view: ViewType.LOADING,
        stattusCode: 0,
        isUnlocked: isUnlocked(STAGE_NAME.LOADING),
        stageName: STAGE_NAME.LOADING,
        appName: '',
        isCiPipeline: false,
        isCDPipeline: false,
        showDeleteConfirm: false,
        navItems: [],
        maximumAllowedUrl: '',
        canDeleteApp: false,
    })

    useEffect(() => {
        Promise.all([getAppConfigStatus(+appId), getWorkflowList(appId)])
            .then(([configStatusRes, workflowRes]) => {
                let lastConfiguredStage = configStatusRes.result
                    .slice()
                    .reverse()
                    .find((stage) => stage.status)
                let lastConfiguredStageName = lastConfiguredStage.stageName
                let configs = isUnlocked(lastConfiguredStageName)
                let { navItems } = getNavItems(configs, appId)
                let index = navItems.findIndex((item) => item.isLocked)
                if (index < 0) {
                    index = 4
                }
                let redirectUrl = navItems[index - 1].href
                let isCiPipeline = isCIPipelineCreated(configStatusRes.result)
                let isCDPipeline = isCDPipelineCreated(configStatusRes.result)

                setState({
                    view: ViewType.FORM,
                    stattusCode: 200,
                    showDeleteConfirm: false,
                    appName: workflowRes.result.appName,
                    isUnlocked: configs,
                    stageName: lastConfiguredStage,
                    isCiPipeline,
                    isCDPipeline,
                    navItems,
                    maximumAllowedUrl: redirectUrl,
                    canDeleteApp: workflowRes.result.workflows.length === 0,
                })
                if (location.pathname === match.url) {
                    history.replace(redirectUrl)
                }
            })
            .catch((errors) => {
                showError(errors)
                setState({ ...state, view: ViewType.ERROR, stattusCode: errors.code })
            })
    }, [appId])

    function reloadWorkflows() {
        getWorkflowList(appId).then((response) => {
            setState({
                ...state,
                canDeleteApp: response.result.workflows.length === 0,
            })
        })
    }
    function redirectToWorkflowEditor() {
        return getAppComposeURL(appId, APP_COMPOSE_STAGE.WORKFLOW_EDITOR)
    }

    async function deleteAppHandler() {
        deleteApp(appId)
            .then((response) => {
                if (response.code === 200) {
                    toast.success('Application Deleted!!!')
                    history.push(`${URLS.APP}`)
                }
            })
            .catch((error) => {
                showError(error)
            })
    }

    function respondOnSuccess() {
        getAppConfigStatus(+appId)
            .then((configStatusRes) => {
                let lastConfiguredStage = configStatusRes.result
                    .slice()
                    .reverse()
                    .find((stage) => stage.status)
                let configs = isUnlocked(lastConfiguredStage.stageName)
                let { navItems } = getNavItems(configs, appId)
                let index = navItems.findIndex((item) => item.isLocked)
                if (index < 0) {
                    index = 4
                }
                let redirectUrl = navItems[index - 1].href
                let isCiPipeline = isCIPipelineCreated(configStatusRes.result)
                let isCDPipeline = isCDPipelineCreated(configStatusRes.result)

                setState((state) => ({
                    ...state,
                    isUnlocked: configs,
                    stageName: lastConfiguredStage,
                    isCiPipeline,
                    isCDPipeline,
                    navItems,
                    maximumAllowedUrl: redirectUrl,
                }))
            })
            .catch((errors) => {
                showError(errors)
            })
    }

    function showDeleteConfirmation() {
        setState((state) => ({ ...state, showDeleteConfirm: true }))
    }

    function renderDeleteDialog() {
        if (state.showDeleteConfirm) {
            if (state.canDeleteApp)
                return (
                    <DeleteDialog
                        title={`Delete '${state.appName}'?`}
                        delete={deleteAppHandler}
                        closeDelete={() => {
                            setState((state) => ({ ...state, showDeleteConfirm: false }))
                        }}
                    >
                        <DeleteDialog.Description>
                            <p className="fs-13 cn-7 lh-1-54">
                                This will delete all resources associated with this application.
                            </p>
                            <p className="fs-13 cn-7 lh-1-54">Deleted applications cannot be restored.</p>
                        </DeleteDialog.Description>
                    </DeleteDialog>
                )
            else {
                return (
                    <ConfirmationDialog>
                        <ConfirmationDialog.Icon src={warn} />
                        <ConfirmationDialog.Body title="Cannot Delete application" />
                        <p className="fs-13 cn-7 lh-1-54">
                            Delete all pipelines and workflows before deleting this application.
                        </p>
                        <ConfirmationDialog.ButtonGroup>
                            <button
                                type="button"
                                className="cta cancel"
                                onClick={(e) => {
                                    setState((state) => ({ ...state, showDeleteConfirm: false }))
                                }}
                            >
                                Cancel
                            </button>
                            <Link
                                onClick={(e) => setState((state) => ({ ...state, showDeleteConfirm: false }))}
                                to={redirectToWorkflowEditor()}
                                className="cta ml-12 no-decor"
                            >
                                View Workflows
                            </Link>
                        </ConfirmationDialog.ButtonGroup>
                    </ConfirmationDialog>
                )
            }
        }
        return null
    }

    if (state.view === ViewType.LOADING) return <Progressing pageLoader />
    else if (state.view === ViewType.ERROR) return <ErrorScreenManager code={state.stattusCode} />
    else
        return (
            <>
                <div className="app-compose">
                    <div
                        className={`app-compose__nav flex column left top position-rel dc__overflow-scroll ${
                            state.isCDPipeline ? 'hide-app-config-help' : ''
                        }`}
                    >
                        <Navigation
                            deleteApp={showDeleteConfirmation}
                            navItems={state.navItems}
                            isCDPipeline={state.isCDPipeline}
                        />
                    </div>
                    <div className="app-compose__main">
                        <AppComposeRouter
                            navItems={state.navItems}
                            isUnlocked={state.isUnlocked}
                            isCiPipeline={state.isCiPipeline}
                            isCDPipeline={state.isCDPipeline}
                            maxAllowedUrl={state.maximumAllowedUrl}
                            respondOnSuccess={respondOnSuccess}
                            getWorkflows={reloadWorkflows}
                            environments={environments}
                            setEnvironments={setEnvironments}
                        />
                    </div>
                </div>
                {renderDeleteDialog()}
            </>
        )
}

const NextButton: React.FC<NextButtonProps> = ({ isCiPipeline, navItems, currentStageName, isDisabled }) => {
    const history = useHistory()
    let index = navItems.findIndex((item) => item.stage === currentStageName)
    let nextUrl = navItems[index + 1].href
    if (!isCiPipeline) {
        return (
            <div className="app-compose__next-section">
                <button
                    type="button"
                    disabled={isDisabled}
                    className="cta align-right flex"
                    onClick={(event) => {
                        history.push(nextUrl)
                    }}
                >
                    <span className="mr-5">Next </span>
                    <Next className="icon-dim-18" />
                </button>
            </div>
        )
    }
    return null
}

function Navigation({ navItems, deleteApp, isCDPipeline }: AppConfigNavigationProps) {
    const location = useLocation()
    const selectedNav = navItems.filter((navItem) => location.pathname.indexOf(navItem.href) >= 0)[0]
    return (
        <>
            {!isCDPipeline && <AppConfigurationCheckBox selectedNav={selectedNav} />}
            {navItems.map((item) => {
                if (item.stage !== 'ENV_OVERRIDE' || (item.stage === 'ENV_OVERRIDE' && item.isLocked)) {
                    return (
                        <NavLink
                            key={item.title}
                            onClick={(event) => {
                                if (item.isLocked) event.preventDefault()
                            }}
                            className={'app-compose__nav-item cursor'}
                            to={item.href}
                        >
                            {item.title}
                            {item.isLocked && <Lock className="app-compose__nav-icon icon-dim-20 mt-10" />}
                        </NavLink>
                    )
                } else {
                    return <EnvironmentOverrideRouter key={item.title} />
                }
            })}
            <div className="cta-delete-app flex w-100 position-sticky pt-2 pb-16 bcn-0">
                <button type="button" className="flex cta delete mt-8 w-100 h-36" onClick={deleteApp}>
                    Delete Application
                </button>
            </div>
        </>
    )
}

function AppComposeRouter({
    isUnlocked,
    navItems,
    respondOnSuccess,
    isCiPipeline,
    getWorkflows,
    maxAllowedUrl,
    isCDPipeline,
    environments,
    setEnvironments,
}: AppComposeRouterProps) {
    const { path } = useRouteMatch()

    return (
        <ErrorBoundary>
            <Suspense fallback={<Progressing pageLoader />}>
                <Switch>
                    <Route path={`${path}/${URLS.APP_GIT_CONFIG}`}>
                        <>
                            <MaterialList
                                respondOnSuccess={respondOnSuccess}
                                isWorkflowEditorUnlocked={isUnlocked.workflowEditor}
                            />
                            <NextButton
                                currentStageName={STAGE_NAME.GIT_MATERIAL}
                                navItems={navItems}
                                isDisabled={!isUnlocked.dockerBuildConfig}
                                isCiPipeline={isCiPipeline}
                            />
                        </>
                    </Route>
                    {isUnlocked.dockerBuildConfig && (
                        <Route path={`${path}/${URLS.APP_DOCKER_CONFIG}`}>
                            <>
                                <CIConfig respondOnSuccess={respondOnSuccess} />
                                <NextButton
                                    currentStageName={STAGE_NAME.CI_CONFIG}
                                    navItems={navItems}
                                    isDisabled={!isUnlocked.deploymentTemplate}
                                    isCiPipeline={isCiPipeline}
                                />
                            </>
                        </Route>
                    )}
                    {isUnlocked.deploymentTemplate && (
                        <Route path={`${path}/${URLS.APP_DEPLOYMENT_CONFIG}`}>
                            <DeploymentConfig
                                respondOnSuccess={respondOnSuccess}
                                isUnSet={!isUnlocked.workflowEditor}
                                navItems={navItems}
                                isCiPipeline={isCiPipeline}
                                environments={environments}
                                setEnvironments={setEnvironments}
                            />
                        </Route>
                    )}
                    {isUnlocked.workflowEditor && (
                        <>
                            <Route
                                path={`${path}/${URLS.APP_WORKFLOW_CONFIG}/:workflowId(\\d+)?`}
                                render={(props) => (
                                    <WorkflowEdit
                                        configStatus={1}
                                        isCDPipeline={isCDPipeline}
                                        respondOnSuccess={respondOnSuccess}
                                        getWorkflows={getWorkflows}
                                    />
                                )}
                            />
                            <Route
                                path={`${path}/${URLS.APP_CM_CONFIG}`}
                                render={(props) => <ConfigMap respondOnSuccess={respondOnSuccess} />}
                            />
                            <Route
                                path={`${path}/${URLS.APP_CS_CONFIG}`}
                                render={(props) => <Secret respondOnSuccess={respondOnSuccess} />}
                            />
                            <Route
                                path={`${path}/${URLS.APP_ENV_OVERRIDE_CONFIG}/:envId(\\d+)?`}
                                render={(props) => (
                                    <EnvironmentOverride
                                        environments={environments}
                                        setEnvironments={setEnvironments}
                                    />
                                )}
                            />
                        </>
                    )}
                </Switch>
            </Suspense>
        </ErrorBoundary>
    )
}

const EnvOverridesHelpNote = () => {
    return (
        <div className="fs-12 fw-4 lh-18">
            Environment overrides allow you to manage environment specific configurations after you’ve created
            deployment pipelines. &nbsp;
            <a
                className="learn-more__href"
                href={DOCUMENTATION.APP_CREATE_ENVIRONMENT_OVERRIDE}
                rel="noreferrer noopener"
                target="_blank"
            >
                Learn more
            </a>
        </div>
    )
}

const EnvOverrideRoute = ({ envOverride }: EnvironmentOverrideRouteProps) => {
    const { url } = useRouteMatch()
    const location = useLocation()
    const LINK = `${url}/${URLS.APP_ENV_OVERRIDE_CONFIG}/${envOverride.environmentId}`
    const [collapsed, toggleCollapsed] = useState(location.pathname.includes(`${LINK}/`) ? false : true)

    useEffect(() => {
        if (!location.pathname.includes(`${LINK}/`) && !collapsed) {
            toggleCollapsed(true)
        }
    }, [location.pathname])

    const handleNavItemClick = () => {
        toggleCollapsed(!collapsed)
    }

    return (
        <div className="flex column left environment-route-wrapper top">
            <div
                className={`app-compose__nav-item flex cursor ${collapsed ? 'fw-4' : 'fw-6 no-hover'}`}
                onClick={handleNavItemClick}
            >
                {envOverride.environmentName}
                <Dropdown
                    className="icon-dim-24 rotate"
                    style={{ ['--rotateBy' as any]: `${Number(!collapsed) * 180}deg` }}
                />
            </div>
            {!collapsed && (
                <div className="environment-routes">
                    <NavLink className="app-compose__nav-item cursor" to={`${LINK}/deployment-template`}>
                        Deployment template
                    </NavLink>
                    <NavLink className="app-compose__nav-item cursor" to={`${LINK}/configmap`}>
                        ConfigMaps
                    </NavLink>
                    <NavLink className="app-compose__nav-item cursor" to={`${LINK}/secrets`}>
                        Secrets
                    </NavLink>
                </div>
            )}
        </div>
    )
}

const EnvironmentOverrides = ({ environmentResult, environmentsLoading }: EnvironmentOverridesProps) => {
    if (environmentsLoading) return null

    if (Array.isArray(environmentResult?.result)) {
        const environments = environmentResult.result.sort((a, b) => a.environmentName.localeCompare(b.environmentName))
        return (
            <div className="w-100" style={{ height: 'calc(100% - 60px)' }}>
                {environments.map((env) => {
                    return <EnvOverrideRoute envOverride={env} key={env.environmentName} />
                })}
            </div>
        )
    } else {
        return (
            <InfoColourBar
                classname="question-bar no-env-overrides"
                message={<EnvOverridesHelpNote />}
                Icon={Help}
                iconClass="fcv-5"
                iconSize={16}
            />
        )
    }
}

function EnvironmentOverrideRouter() {
    const { pathname } = useLocation()
    const { appId } = useParams<{ appId: string }>()
    const previousPathName = usePrevious(pathname)
    const [environmentsLoading, environmentResult, error, reloadEnvironments] = useAsync(
        () => getAppOtherEnvironment(appId),
        [appId],
        !!appId,
    )
    useEffect(() => {
        if (previousPathName && previousPathName.includes('/cd-pipeline') && !pathname.includes('/cd-pipeline')) {
            reloadEnvironments()
        }
    }, [pathname])

    return (
        <div className="h-100">
            <div className="border-bottom-n1 mt-8 mb-8" />
            <div className="app-compose__nav-item routes-container-header flex text-uppercase no-hover">
                Environment Overrides
            </div>
            <div className="flex column left environment-routes-container top">
                <EnvironmentOverrides environmentsLoading={environmentsLoading} environmentResult={environmentResult} />
            </div>
        </div>
    )
}
