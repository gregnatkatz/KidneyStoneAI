/**
 * Kidney Stone Research Platform - Utility Functions
 * Developed by Greg Katz
 * 
 * Purpose: Common utility functions for class names and styling
 * Dependencies: clsx, tailwind-merge
 * Last Updated: September 25, 2025
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
