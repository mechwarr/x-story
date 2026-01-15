//
//  WeChatPackage.swift
//  storyappv2
//
//  WeChat 模組註冊器 - iOS 版本
//  對應 Android 的 WeChatPackage.java
//  
//  注意：在 Expo 項目中，繼承自 RCTEventEmitter 的類會自動註冊
//  這個文件主要是為了保持與 Android 結構的一致性
//  實際上可能不需要，但如果保留，需要確保不會導致編譯錯誤
//

import Foundation
import React

@objc(WeChatPackage)
public class WeChatPackage: NSObject {
  // 在 Expo 項目中，WeChatModule 會通過自動鏈接自動註冊
  // 這裡不需要額外的註冊邏輯
  // 如果遇到編譯錯誤，可以考慮刪除此文件
}

