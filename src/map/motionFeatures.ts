// the animation engine for every <m.*> element on the map (springs, exit, drag, layout). Loaded
// after first paint through LazyMotion in MapExperience, so it never blocks the first load
import { domMax } from "motion/react"

export default domMax
