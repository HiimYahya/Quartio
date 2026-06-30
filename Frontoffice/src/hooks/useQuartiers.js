import { useEffect, useState } from 'react'
import api from '../services/api'

export default function useQuartiers() {
  const [quartiers, setQuartiers] = useState([])

  useEffect(() => {
    api.get('/quartiers?limit=100')
      .then(({ data }) => setQuartiers(data.data ?? data.quartiers ?? []))
      .catch(() => setQuartiers([]))
  }, [])

  return quartiers
}
