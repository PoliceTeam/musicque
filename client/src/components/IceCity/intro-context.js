import { createContext, useContext } from 'react'

export const IceCityIntroContext = createContext({ pending: false })
export const useIceCityIntroStatus = () => useContext(IceCityIntroContext)
