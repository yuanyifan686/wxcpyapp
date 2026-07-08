import * as storage from './storage.js'

let currentFortune = null
let userInfo = storage.getUserInfo()
let userId = storage.getUserId()

export function getUserId() {
  if (!userId) userId = storage.getUserId()
  return userId
}

export function getUserInfo() {
  return userInfo || storage.getUserInfo()
}

export function updateUserInfo(info) {
  userInfo = info
  storage.setUserInfo(info)
}

export function setCurrentFortune(fortune) {
  currentFortune = fortune
}

export function getCurrentFortune() {
  return currentFortune
}