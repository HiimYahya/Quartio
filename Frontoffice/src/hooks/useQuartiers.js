import { useEffect, useState } from 'react'
import api from '../services/api'

export default function useQuartiers() {
  const [quartiers, setQuartiers] = useState([])

  useEffect(() => {
    api.get('/quartiers')
      .then(({ data }) => setQuartiers(data.quartiers ?? data ?? []))
      .catch(() => setQuartiers([]))
  }, [])

  return quartiers
}
