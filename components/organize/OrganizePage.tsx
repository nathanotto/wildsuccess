'use client'
import { UserValue, LifeDomain } from '@/lib/types'
import OrganizeWeekModal from './OrganizeWeekModal'

interface Props {
  values: UserValue[]
  domains: LifeDomain[]
}

export default function OrganizePage({ values, domains }: Props) {
  return (
    <OrganizeWeekModal
      values={values}
      domains={domains}
      mode="page"
    />
  )
}
