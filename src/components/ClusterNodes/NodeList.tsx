import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useRouteMatch, useParams, useHistory } from 'react-router'
import { getClusterCapacity, getNodeList, getClusterList } from './clusterNodes.service'
import {
    BreadCrumb,
    ConditionalWrap,
    handleUTCTime,
    Pagination,
    Progressing,
    showError,
    useBreadcrumb,
} from '../common'
import {
    ClusterCapacityType,
    ClusterListResponse,
    COLUMN_METADATA,
    ColumnMetadataType,
    TEXT_COLOR_CLASS,
    ERROR_TYPE,
} from './types'
import { ReactComponent as Error } from '../../assets/icons/ic-error-exclamation.svg'
import { ReactComponent as Dropdown } from '../../assets/icons/ic-chevron-down.svg'
import { ReactComponent as Sort } from '../../assets/icons/ic-sort-arrow.svg'
import PageHeader from '../common/header/PageHeader'
import ReactSelect, { MultiValue } from 'react-select'
import { appSelectorStyle, DropdownIndicator } from '../AppSelector/AppSelectorUtil'
import { OptionType } from '../app/types'
import NodeListSearchFilter from './NodeListSearchFilter'
import { OrderBy } from '../app/list/types'
import ClusterNodeEmptyState from './ClusterNodeEmptyStates'
import Tippy from '@tippyjs/react'
import './clusterNodes.scss'

export default function NodeList() {
    const match = useRouteMatch()
    const history = useHistory()
    const [loader, setLoader] = useState(false)
    const [searchText, setSearchText] = useState('')
    const [clusterCapacityData, setClusterCapacityData] = useState<ClusterCapacityType>(null)
    const [lastDataSyncTimeString, setLastDataSyncTimeString] = useState('')
    const [lastDataSync, setLastDataSync] = useState(false)
    const [collapsedErrorSection, setCollapsedErrorSection] = useState<boolean>(true)
    const { clusterId } = useParams<{ clusterId: string }>()
    const [clusterList, setClusterList] = useState<OptionType[]>([])
    const [selectedCluster, setSelectedCluster] = useState<OptionType>({
        label: '',
        value: '',
    })
    const defaultVersion = { label: 'K8s version: Any', value: 'K8s version: Any' }
    const [clusterErrorTitle, setClusterErrorTitle] = useState('')
    const [clusterErrorList, setClusterErrorList] = useState<
        { errorText: string; errorType: ERROR_TYPE; filterText: string[] }[]
    >([])
    const [flattenNodeList, setFlattenNodeList] = useState<object[]>([])
    const [filteredFlattenNodeList, setFilteredFlattenNodeList] = useState<object[]>([])
    const [searchedTextMap, setSearchedTextMap] = useState<Map<string, string>>(new Map())
    const [selectedVersion, setSelectedVersion] = useState<OptionType>(defaultVersion)
    const [selectedSearchTextType, setSelectedSearchTextType] = useState<string>('')
    const [sortByColumn, setSortByColumn] = useState<ColumnMetadataType>(COLUMN_METADATA[0])
    const [sortOrder, setSortOrder] = useState<string>(OrderBy.ASC)
    const [noResults, setNoResults] = useState(false)
    const [appliedColumns, setAppliedColumns] = useState<MultiValue<ColumnMetadataType>>([])
    const [fixedNodeNameColumn, setFixedNodeNameColumn] = useState(false)
    const [nodeListOffset, setNodeListOffset] = useState(0)
    const pageSize = 15

    useEffect(() => {
        if (appliedColumns.length > 0) {
            const appliedColumnDerivedWidth = appliedColumns.length * 116 + 180 + 65
            const windowWidth = window.innerWidth
            let clientWidth = 0
            setFixedNodeNameColumn(windowWidth < clientWidth || windowWidth < appliedColumnDerivedWidth)
        }
    }, [appliedColumns])

    useEffect(() => {
        let appliedColumnsFromLocalStorage
        const _defaultColumns = COLUMN_METADATA.filter((columnData) => columnData.isDefault)
        if (typeof Storage !== 'undefined') {
            if (!localStorage.appliedColumns) {
                localStorage.appliedColumns = JSON.stringify(_defaultColumns)
            } else {
                try {
                    appliedColumnsFromLocalStorage = JSON.parse(localStorage.appliedColumns)
                } catch (error) {}
            }
        }
        setAppliedColumns(appliedColumnsFromLocalStorage || _defaultColumns)
    }, [])

    const flattenObject = (ob: Object): Object => {
        let toReturn = {}
        for (let i in ob) {
            if (!ob.hasOwnProperty(i)) continue
            const currentElement = ob[i]
            if (typeof currentElement == 'object' && currentElement !== null && !Array.isArray(currentElement)) {
                var flatObject = flattenObject(currentElement)
                for (var x in flatObject) {
                    if (!flatObject.hasOwnProperty(x)) continue

                    toReturn[i + '.' + x] = flatObject[x]
                }
            } else {
                toReturn[i] = currentElement
            }
        }
        return toReturn
    }

    const getNodeListData = (): void => {
        setLoader(true)
        Promise.all([getNodeList(clusterId), getClusterCapacity(clusterId)])
            .then((response) => {
                setLastDataSync(!lastDataSync)
                if (response[0].result) {
                    const _flattenNodeList = response[0].result.map((data) => {
                        const _flattenNodeData = flattenObject(data)
                        if (data['errors']) {
                            _flattenNodeData['errorCount'] = Object.keys(data['errors']).length
                        }
                        return _flattenNodeData
                    })
                    setFlattenNodeList(_flattenNodeList)
                }
                if (response[1].result) {
                    setClusterCapacityData(response[1].result)
                    let _errorTitle = '',
                        _errorList = [],
                        _nodeErrors = Object.keys(response[1].result.nodeErrors || {})
                    const _nodeK8sVersions = response[1].result.nodeK8sVersions
                    if (_nodeK8sVersions.length > 1) {
                        let diffType = '',
                            majorVersion,
                            minorVersion
                        for (let index = 0; index < _nodeK8sVersions.length; index++) {
                            const elementArr = _nodeK8sVersions[index].split('.')
                            if (!majorVersion) {
                                majorVersion = elementArr[0]
                            }
                            if (!minorVersion) {
                                minorVersion = elementArr[1]
                            }
                            if (majorVersion !== elementArr[0]) {
                                diffType = 'Major'
                                break
                            } else if (diffType !== 'Minor' && minorVersion !== elementArr[1]) {
                                diffType = 'Minor'
                            }
                        }
                        if (diffType !== '') {
                            _errorTitle = 'Version diff'
                            _errorList.push({
                                errorText: `${diffType} version diff identified among nodes. Current versions `,
                                errorType: ERROR_TYPE.VERSION_ERROR,
                                filterText: _nodeK8sVersions,
                            })
                        }
                    }

                    if (_nodeErrors.length > 0) {
                        _errorTitle += (_errorTitle ? ', ' : '') + _nodeErrors.join(', ')
                        for (let i = 0; i < _nodeErrors.length; i++) {
                            const _errorLength = response[1].result.nodeErrors[_nodeErrors[i]].length
                            _errorList.push({
                                errorText: `${_nodeErrors[i]} on ${
                                    _errorLength === 1 ? `${_errorLength} node` : `${_errorLength} nodes`
                                }`,
                                errorType: ERROR_TYPE.OTHER,
                                filterText: response[1].result.nodeErrors[_nodeErrors[i]],
                            })
                        }
                    }
                    setClusterErrorTitle(_errorTitle)
                    setClusterErrorList(_errorList)
                }
                setLoader(false)
            })
            .catch((error) => {
                showError(error)
                setLoader(false)
            })
    }

    useEffect(() => {
        getNodeListData()
    }, [clusterId])

    useEffect(() => {
        getClusterList()
            .then((response: ClusterListResponse) => {
                setLastDataSync(!lastDataSync)
                if (response.result) {
                    const optionList = response.result
                        .filter((cluster) => !cluster.errorInNodeListing)
                        .map((cluster) => {
                            const _clusterId = cluster.id?.toString()
                            if (_clusterId === clusterId) {
                                setSelectedCluster({
                                    label: cluster.name,
                                    value: _clusterId,
                                })
                            }
                            return {
                                label: cluster.name,
                                value: _clusterId,
                            }
                        })
                    setClusterList(optionList)
                }
            })
            .catch((error) => {
                showError(error)
            })
    }, [])

    useEffect(() => {
        const _lastDataSyncTime = Date()
        setLastDataSyncTimeString('Last refreshed ' + handleUTCTime(_lastDataSyncTime, true))
        const interval = setInterval(() => {
            setLastDataSyncTimeString('Last refreshed ' + handleUTCTime(_lastDataSyncTime, true))
        }, 1000)
        return () => {
            clearInterval(interval)
        }
    }, [lastDataSync])

    const handleFilterChanges = (): void => {
        let _flattenNodeList = []
        for (let index = 0; index < flattenNodeList.length; index++) {
            const element = flattenNodeList[index]
            if (selectedVersion.value !== defaultVersion.value && element['k8sVersion'] !== selectedVersion.value) {
                continue
            }
            if (selectedSearchTextType === 'name' && searchedTextMap.size > 0) {
                let matchFound = false
                for (const [key] of searchedTextMap.entries()) {
                    if (element['name'].indexOf(key) >= 0) {
                        matchFound = true
                        break
                    }
                }
                if (!matchFound) {
                    continue
                }
            } else if (selectedSearchTextType === 'label') {
                let matchedLabelCount = 0
                for (let i = 0; i < element['labels']?.length; i++) {
                    const currentLabel = element['labels'][i]
                    const matchedLabel = searchedTextMap.get(currentLabel.key)
                    if (matchedLabel === undefined || (matchedLabel !== null && currentLabel.value !== matchedLabel)) {
                        continue
                    }
                    matchedLabelCount++
                }
                if (searchedTextMap.size !== matchedLabelCount) {
                    continue
                }
            }
            _flattenNodeList.push(element)
        }
        if (sortByColumn) {
            const comparatorMethod =
                sortByColumn.sortType === 'number' ? numericComparatorMethod : alphabeticalComparatorMethod
            _flattenNodeList.sort(comparatorMethod)
        }
        setFilteredFlattenNodeList(_flattenNodeList)
        setNoResults(_flattenNodeList.length === 0)
    }

    const numericComparatorMethod = (a, b) => {
        let firstValue = a[sortByColumn.sortingFieldName] || 0
        let secondValue = b[sortByColumn.sortingFieldName] || 0
        if (typeof firstValue === 'string' && firstValue.endsWith('%')) {
            firstValue = firstValue.slice(0, -1)
            secondValue = secondValue.slice(0, -1)
        }
        return sortOrder === OrderBy.ASC ? firstValue - secondValue : secondValue - firstValue
    }

    const alphabeticalComparatorMethod = (a, b) => {
        return (sortOrder === OrderBy.ASC && sortByColumn.sortingFieldName !== 'createdAt') ||
            (sortOrder === OrderBy.DESC && sortByColumn.sortingFieldName === 'createdAt')
            ? a[sortByColumn.sortingFieldName].localeCompare(b[sortByColumn.sortingFieldName])
            : b[sortByColumn.sortingFieldName].localeCompare(a[sortByColumn.sortingFieldName])
    }

    const clearFilter = (): void => {
        setSearchText('')
        setSelectedSearchTextType('')
        setSearchedTextMap(new Map())
    }

    useEffect(() => {
        handleFilterChanges()
    }, [searchedTextMap, searchText, flattenNodeList, sortByColumn, sortOrder])

    const onClusterChange = (selectedValue: OptionType): void => {
        setSelectedCluster(selectedValue)
        history.push(match.url.replace(clusterId, selectedValue.value))
    }

    const { breadcrumbs } = useBreadcrumb(
        {
            alias: {
                clusters: {
                    component: 'Clusters',
                    linked: true,
                },
                ':clusterId': {
                    component: (
                        <ReactSelect
                            options={clusterList}
                            onChange={onClusterChange}
                            components={{
                                IndicatorSeparator: null,
                                DropdownIndicator,
                            }}
                            value={selectedCluster}
                            styles={appSelectorStyle}
                        />
                    ),
                    linked: false,
                },
            },
        },
        [clusterId, clusterList],
    )

    const renderBreadcrumbs = (): JSX.Element => {
        return <BreadCrumb breadcrumbs={breadcrumbs} />
    }

    const handleSortClick = (column: ColumnMetadataType): void => {
        if (sortByColumn.label === column.label) {
            setSortOrder(sortOrder === OrderBy.ASC ? OrderBy.DESC : OrderBy.ASC)
        } else {
            setSortByColumn(column)
            setSortOrder(OrderBy.ASC)
        }
    }

    const setCustomFilter = (errorType: ERROR_TYPE, filterText: string): void => {
        if (errorType === ERROR_TYPE.VERSION_ERROR) {
            const selectedVersion = `K8s version: ${filterText}`
            setSelectedVersion({ label: selectedVersion, value: selectedVersion })
        } else {
            const _searchedTextMap = new Map()
            const searchedLabelArr = filterText.split(',')
            for (let index = 0; index < searchedLabelArr.length; index++) {
                const currentItem = searchedLabelArr[index].trim()
                _searchedTextMap.set(currentItem, true)
            }
            setSelectedSearchTextType('name')
            setSearchedTextMap(_searchedTextMap)
            setSearchText(filterText)
        }
    }

    const renderClusterError = (): JSX.Element => {
        if (clusterErrorList.length === 0) return
        return (
            <div
                className={`pl-20 pr-20 pt-12 bcr-1 border-top border-bottom ${
                    collapsedErrorSection ? ' pb-12 ' : ' pb-8'
                }`}
            >
                <div className={`flexbox content-space ${collapsedErrorSection ? '' : ' mb-16'}`}>
                    <span
                        className="flexbox pointer"
                        onClick={(event) => {
                            setCollapsedErrorSection(!collapsedErrorSection)
                        }}
                    >
                        <Error className="mt-2 mb-2 mr-8 icon-dim-18" />
                        <span className="fw-6 fs-13 cn-9 mr-16">
                            {clusterErrorList.length === 1 ? '1 Error' : clusterErrorList.length + ' Errors in cluster'}
                        </span>
                        {collapsedErrorSection && <span className="fw-4 fs-13 cn-9">{clusterErrorTitle}</span>}
                    </span>
                    <Dropdown
                        className="pointer"
                        style={{ transform: collapsedErrorSection ? 'rotate(0)' : 'rotate(180deg)' }}
                        onClick={(event) => {
                            setCollapsedErrorSection(!collapsedErrorSection)
                        }}
                    />
                </div>
                {!collapsedErrorSection && (
                    <>
                        {clusterErrorList.map((error) => (
                            <div className="fw-4 fs-13 cn-9 mb-8">
                                {error.errorText}
                                {error.errorType === ERROR_TYPE.OTHER ? (
                                    <span
                                        className="cb-5 pointer"
                                        onClick={(event) => {
                                            setCustomFilter(error.errorType, error.filterText.join(','))
                                        }}
                                    >
                                        &nbsp; View nodes
                                    </span>
                                ) : (
                                    error.filterText.map((filter, index) => (
                                        <>
                                            &nbsp;
                                            {index > 0 && ', '}
                                            <span
                                                className="cb-5 pointer"
                                                onClick={(event) => {
                                                    setCustomFilter(error.errorType, filter)
                                                }}
                                            >
                                                {filter}
                                            </span>
                                        </>
                                    ))
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        )
    }

    const renderClusterSummary = (): JSX.Element => {
        return (
            <>
                <div className="flexbox content-space pl-20 pr-20 pt-16 pb-16">
                    <div className="fw-6 fs-14 cn-9">Resource allocation and usage</div>
                    <div className="fs-13">
                        {lastDataSyncTimeString && (
                            <span>
                                {lastDataSyncTimeString}
                                <button className="btn btn-link p-0 fw-6 cb-5 ml-5 fs-13" onClick={getNodeListData}>
                                    Refresh
                                </button>
                            </span>
                        )}
                    </div>
                </div>
                <div className="flexbox content-space pl-20 pr-20 pb-20">
                    <div className="flexbox content-space mr-16 w-50 p-16 bcn-0 br-4 en-2 bw-1">
                        <div className="mr-16 w-25">
                            <div className="align-center fs-13 fw-4 cn-7">CPU Usage</div>
                            <div className="align-center fs-24 fw-4 cn-9">
                                {clusterCapacityData?.cpu?.usagePercentage}
                            </div>
                        </div>
                        <div className="mr-16 w-25">
                            <div className="align-center fs-13 fw-4 cn-7">CPU Capacity</div>
                            <div className="align-center fs-24 fw-4 cn-9">{clusterCapacityData?.cpu?.capacity}</div>
                        </div>
                        <div className="mr-16 w-25">
                            <div className="align-center fs-13 fw-4 cn-7">CPU Requests</div>
                            <div className="align-center fs-24 fw-4 cn-9">
                                {clusterCapacityData?.cpu?.requestPercentage}
                            </div>
                        </div>
                        <div className="w-25">
                            <div className="align-center fs-13 fw-4 cn-7">CPU Limits</div>
                            <div className="align-center fs-24 fw-4 cn-9">
                                {clusterCapacityData?.cpu?.limitPercentage}
                            </div>
                        </div>
                    </div>

                    <div className="flexbox content-space w-50 p-16 bcn-0 br-4 en-2 bw-1">
                        <div className="mr-16 w-25">
                            <div className="align-center fs-13 fw-4 cn-7">Memory Usage</div>
                            <div className="align-center fs-24 fw-4 cn-9">
                                {clusterCapacityData?.memory?.usagePercentage}
                            </div>
                        </div>
                        <div className="mr-16 w-25">
                            <div className="align-center fs-13 fw-4 cn-7">Memory Capacity</div>
                            <div className="align-center fs-24 fw-4 cn-9">{clusterCapacityData?.memory?.capacity}</div>
                        </div>
                        <div className="mr-16 w-25">
                            <div className="align-center fs-13 fw-4 cn-7">Memory Requests</div>
                            <div className="align-center fs-24 fw-4 cn-9">
                                {clusterCapacityData?.memory?.requestPercentage}
                            </div>
                        </div>
                        <div className="w-25">
                            <div className="align-center fs-13 fw-4 cn-7">Memory Limits</div>
                            <div className="align-center fs-24 fw-4 cn-9">
                                {clusterCapacityData?.memory?.limitPercentage}
                            </div>
                        </div>
                    </div>
                </div>
                {renderClusterError()}
            </>
        )
    }

    const renderNodeListHeader = (column: ColumnMetadataType): JSX.Element => {
        return (
            <div
                className={`h-36 list-title inline-block mr-16 pt-8 pb-8 ${
                    column.label === 'Node'
                        ? `${fixedNodeNameColumn ? 'bcn-0 position-sticky sticky-column border-right' : ''} w-280 pl-20`
                        : 'w-100-px'
                } ${sortByColumn.value === column.value ? 'sort-by' : ''} ${sortOrder === OrderBy.DESC ? 'desc' : ''} ${
                    column.isSortingAllowed ? ' pointer' : ''
                }`}
                onClick={() => {
                    column.isSortingAllowed && handleSortClick(column)
                }}
            >
                <Tippy className="default-tt" arrow={false} placement="top" content={column.label}>
                    <span className="inline-block ellipsis-right mw-85px ">{column.label}</span>
                </Tippy>
                {column.isSortingAllowed && <Sort className="pointer icon-dim-14 position-rel sort-icon" />}
            </div>
        )
    }

    const renderPercentageTippy = (nodeData: Object, column: ColumnMetadataType, children: any): JSX.Element => {
        return (
            <Tippy
                className="default-tt"
                arrow={false}
                placement="top"
                content={
                    <>
                        <span style={{ display: 'block' }}>
                            {column.value === 'cpu.usagePercentage'
                                ? `CPU Usage: ${nodeData['cpu.usage']}`
                                : `Memory Usage: ${nodeData['memory.usage']}`}
                        </span>
                        <span style={{ display: 'block' }}>
                            {column.value === 'cpu.usagePercentage'
                                ? `Allocatable CPU: ${nodeData['cpu.allocatable']}`
                                : `Allocatable Memory: ${nodeData['memory.allocatable']}`}
                        </span>
                    </>
                }
            >
                <div>{children}</div>
            </Tippy>
        )
    }

    const renderNodeList = (nodeData: Object): JSX.Element => {
        return (
            <div
                key={nodeData['name']}
                className="fw-4 cn-9 fs-13 border-bottom-n1 pr-20 hover-class h-44"
                style={{ width: 'max-content', minWidth: '100%' }}
            >
                {appliedColumns.map((column) => {
                    return column.label === 'Node' ? (
                        <div
                            className={`w-280 inline-block ellipsis-right mr-16 pl-20 pt-12 pb-12${
                                fixedNodeNameColumn ? ' bcn-0 position-sticky sticky-column border-right' : ''
                            }`}
                        >
                            <NavLink to={`${match.url}/${nodeData[column.value]}`}>{nodeData[column.value]}</NavLink>
                        </div>
                    ) : (
                        <div
                            className={`w-100-px inline-block ellipsis-right mr-16 pt-12 pb-12 ${
                                column.value === 'status' ? TEXT_COLOR_CLASS[nodeData['status']] || 'cn-7' : ''
                            }`}
                        >
                            {column.value === 'errorCount' ? (
                                nodeData['errorCount'] > 0 && (
                                    <>
                                        <Error className="mr-3 icon-dim-16 position-rel top-3" />
                                        <span className="cr-5">{nodeData['errorCount'] || '-'}</span>{' '}
                                    </>
                                )
                            ) : column.sortType === 'boolean' ? (
                                nodeData[column.value] + ''
                            ) : nodeData[column.value] !== undefined ? (
                                <ConditionalWrap
                                    condition={column.value.indexOf('.usagePercentage') > 0}
                                    wrap={(children) => renderPercentageTippy(nodeData, column, children)}
                                >
                                    {nodeData[column.value]}
                                </ConditionalWrap>
                            ) : (
                                '-'
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderPagination = (): JSX.Element => {
        return (
            filteredFlattenNodeList.length > pageSize && (
                <Pagination
                    size={filteredFlattenNodeList.length}
                    pageSize={pageSize}
                    offset={nodeListOffset}
                    changePage={(pageNo: number) => setNodeListOffset(pageSize * (pageNo - 1))}
                    isPageSizeFix={true}
                />
            )
        )
    }

    if (loader) {
        return <Progressing pageLoader />
    }

    return (
        <>
            <PageHeader breadCrumbs={renderBreadcrumbs} isBreadcrumbs={true} />
            <div className="node-list">
                {renderClusterSummary()}
                <div
                    className={`bcn-0 pt-16 list-min-height ${noResults ? 'no-result-container' : ''} ${
                        clusterErrorList?.length ? 'with-error-bar' : ''
                    }`}
                >
                    <div className="pl-20 pr-20">
                        <NodeListSearchFilter
                            defaultVersion={defaultVersion}
                            nodeK8sVersions={clusterCapacityData?.nodeK8sVersions}
                            selectedVersion={selectedVersion}
                            setSelectedVersion={setSelectedVersion}
                            appliedColumns={appliedColumns}
                            setAppliedColumns={setAppliedColumns}
                            selectedSearchTextType={selectedSearchTextType}
                            setSelectedSearchTextType={setSelectedSearchTextType}
                            searchText={searchText}
                            setSearchText={setSearchText}
                            searchedTextMap={searchedTextMap}
                            setSearchedTextMap={setSearchedTextMap}
                        />
                    </div>
                    {noResults ? (
                        <ClusterNodeEmptyState title="No matching nodes" actionHandler={clearFilter} />
                    ) : (
                        <>
                            <div className="mt-16" style={{ width: '100%', overflow: 'auto hidden' }}>
                                <div
                                    className=" fw-6 cn-7 fs-12 border-bottom pr-20 text-uppercase"
                                    style={{ width: 'max-content', minWidth: '100%' }}
                                >
                                    {appliedColumns.map((column) => renderNodeListHeader(column))}
                                </div>
                                {filteredFlattenNodeList
                                    .slice(nodeListOffset, nodeListOffset + pageSize)
                                    ?.map((nodeData) => renderNodeList(nodeData))}
                            </div>
                            {renderPagination()}
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
