import Decimal from "decimal.js";
import { DateTime } from "luxon";

export interface SearchRequest {
    from: number
    to: number
    query?: SearchGroup
    descending: boolean
    orderByColumn: string
}

export type SearchGroup = {
    type: SearchGroupType.Query
    query: SearchQuery
} | AndSearchGroup | OrSearchGroup;

export interface AndSearchGroup {
    type: SearchGroupType.And
    children: SearchGroup[]
}

export interface OrSearchGroup {
    type: SearchGroupType.Or
    children: SearchGroup[]
}

export interface SearchQuery {
    column: string
    value: string | number | Decimal | DateTime | string[] | number[] | Decimal[] | null
    operator: SearchOperator
    not: boolean
}

export enum SearchOperator {
    Equals = 0,
    Contains = 1,
    In = 2,
    GreaterThan = 3,
    GreaterThanOrEqual = 4,
}

export enum SearchGroupType {
    Or = 0,
    And = 1,
    Query = 2,
}

export interface SearchResponse<T> {
    data: T[]
    totalItems: number
}
