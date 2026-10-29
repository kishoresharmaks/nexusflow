"use client"

import { ReactNode, useMemo, useState } from "react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"
import useMeasure from "react-use-measure"

import { cn } from "../../lib/utils"

export type DirectionAwareTab = {
  id: number
  label: string
  content?: ReactNode
}

export interface DirectionAwareTabsProps {
  tabs: DirectionAwareTab[]
  activeTab?: number
  onTabChange?: (tabId: number) => void
  className?: string
  tabClassName?: string
  activeTabClassName?: string
  bubbleClassName?: string
  rounded?: string
  roundedInner?: string
  onChange?: () => void
  showContent?: boolean
}

export function DirectionAwareTabs({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
  tabClassName,
  activeTabClassName,
  bubbleClassName,
  rounded,
  roundedInner,
  onChange,
  showContent = true,
}: DirectionAwareTabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [ref, bounds] = useMeasure()

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab

  const content = useMemo(() => {
    if (!showContent) return null
    const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content
    return activeTabContent || null
  }, [activeTab, tabs, showContent])

  const handleTabClick = (newTabId: number) => {
    if (newTabId !== activeTab && !isAnimating) {
      const newDirection = newTabId > activeTab ? 1 : -1
      setDirection(newDirection)
      if (controlledActiveTab === undefined) {
        setInternalActiveTab(newTabId)
      }
      onTabChange?.(newTabId)
      onChange?.()
    }
  }

  const variants = {
    initial: (dir: number) => ({
      x: 300 * dir,
      opacity: 0,
      filter: "blur(4px)",
    }),
    active: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
    },
    exit: (dir: number) => ({
      x: -300 * dir,
      opacity: 0,
      filter: "blur(4px)",
    }),
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className={cn(
          "flex cursor-pointer space-x-1 rounded-full p-[3px] border border-black/[0.06] bg-[#E5E5EA] shadow-inner",
          className,
          rounded
        )}
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "relative z-1 flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F17]",
                isSelected
                  ? cn("text-[#1D1D1F]", activeTabClassName)
                  : "text-[#6E6E73] hover:text-[#1D1D1F]",
                tabClassName,
                rounded ? roundedInner : undefined
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isSelected && (
                <motion.span
                  layoutId="direction-aware-bubble"
                  className={cn(
                    "absolute inset-0 z-[-1] rounded-full bg-white shadow-sm",
                    bubbleClassName,
                    rounded ? roundedInner : "rounded-full"
                  )}
                  transition={{ type: "spring", bounce: 0.19, duration: 0.4 }}
                />
              )}

              <span className="relative z-10">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {showContent && content && (
        <MotionConfig transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}>
          <motion.div
            className="relative mx-auto h-full w-full overflow-hidden"
            initial={false}
            animate={{ height: bounds.height }}
          >
            <div className="p-1" ref={ref}>
              <AnimatePresence
                custom={direction}
                mode="popLayout"
                onExitComplete={() => setIsAnimating(false)}
              >
                <motion.div
                  key={activeTab}
                  variants={variants}
                  initial="initial"
                  animate="active"
                  exit="exit"
                  custom={direction}
                  onAnimationStart={() => setIsAnimating(true)}
                  onAnimationComplete={() => setIsAnimating(false)}
                >
                  {content}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </MotionConfig>
      )}
    </div>
  )
}
