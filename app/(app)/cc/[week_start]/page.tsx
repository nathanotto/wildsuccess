import { redirect } from 'next/navigation'

type Props = { params: Promise<{ week_start: string }> }

export default async function CCWeekRedirect({ params }: Props) {
  const { week_start } = await params
  redirect(`/week/${week_start}`)
}
