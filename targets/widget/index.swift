// YourLevel home-screen widget: level ring + streak, themed with the
// user's active font colors. Data is written by the app into the App
// Group's UserDefaults (see lib/widget.ts) and re-rendered on every
// XP change via WidgetCenter reloads.

import WidgetKit
import SwiftUI

private let appGroup = "group.com.yourlevel.app"

// MARK: - Snapshot

struct YLSnapshot {
    var level: Int
    var streak: Int
    var currentXp: Int
    var xpToNext: Int
    var accent: Color
    var background: Color
    var foreground: Color

    var progress: Double {
        guard xpToNext > 0 else { return 0 }
        return min(1, max(0, Double(currentXp) / Double(xpToNext)))
    }

    static func load() -> YLSnapshot {
        let d = UserDefaults(suiteName: appGroup)
        let level = max(1, d?.integer(forKey: "yl_level") ?? 1)
        let streak = max(0, d?.integer(forKey: "yl_streak") ?? 0)
        let currentXp = max(0, d?.integer(forKey: "yl_current_xp") ?? 0)
        let xpToNext = max(1, d?.integer(forKey: "yl_xp_to_next") ?? 300)
        return YLSnapshot(
            level: level,
            streak: streak,
            currentXp: currentXp,
            xpToNext: xpToNext,
            accent: Color(hex: d?.string(forKey: "yl_accent") ?? "#4A90E2"),
            background: Color(hex: d?.string(forKey: "yl_bg") ?? "#0A0A0A"),
            foreground: Color(hex: d?.string(forKey: "yl_fg") ?? "#FFFFFF")
        )
    }
}

extension Color {
    init(hex: String) {
        var h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
        var value: UInt64 = 0
        Scanner(string: h).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8) & 0xFF) / 255.0
        let b = Double(value & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Timeline

struct YLEntry: TimelineEntry {
    let date: Date
    let snapshot: YLSnapshot
}

struct YLProvider: TimelineProvider {
    func placeholder(in context: Context) -> YLEntry {
        YLEntry(date: Date(), snapshot: YLSnapshot.load())
    }

    func getSnapshot(in context: Context, completion: @escaping (YLEntry) -> Void) {
        completion(YLEntry(date: Date(), snapshot: YLSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<YLEntry>) -> Void) {
        // The app pushes reloads on every change; the hourly refresh is
        // just a fallback.
        let entry = YLEntry(date: Date(), snapshot: YLSnapshot.load())
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Views

struct LevelRing: View {
    let snapshot: YLSnapshot
    var lineWidth: CGFloat = 8

    var body: some View {
        ZStack {
            Circle()
                .stroke(snapshot.accent.opacity(0.22), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(snapshot.progress))
                .stroke(snapshot.accent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("LV")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundColor(snapshot.foreground.opacity(0.65))
                Text("\(snapshot.level)")
                    .font(.system(size: 26, weight: .black, design: .rounded))
                    .foregroundColor(snapshot.foreground)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            }
        }
    }
}

extension View {
    @ViewBuilder
    func ylWidgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            background(color)
        }
    }
}

struct YLSmallView: View {
    let snapshot: YLSnapshot

    var body: some View {
        VStack(spacing: 6) {
            LevelRing(snapshot: snapshot, lineWidth: 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text("🔥 \(snapshot.streak) day\(snapshot.streak == 1 ? "" : "s")")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(snapshot.foreground.opacity(0.85))
        }
        .padding(12)
        .ylWidgetBackground(snapshot.background)
    }
}

struct YLMediumView: View {
    let snapshot: YLSnapshot

    var body: some View {
        HStack(spacing: 16) {
            LevelRing(snapshot: snapshot, lineWidth: 9)
                .frame(width: 92, height: 92)
            VStack(alignment: .leading, spacing: 5) {
                Text("YourLevel")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundColor(snapshot.accent)
                Text("🔥 \(snapshot.streak)-day streak")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(snapshot.foreground)
                Text("\(snapshot.currentXp) / \(snapshot.xpToNext) XP")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(snapshot.foreground.opacity(0.7))
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .ylWidgetBackground(snapshot.background)
    }
}

struct YLWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: YLProvider.Entry

    var body: some View {
        switch family {
        case .systemMedium:
            YLMediumView(snapshot: entry.snapshot)
        default:
            YLSmallView(snapshot: entry.snapshot)
        }
    }
}

// MARK: - Widget

struct YourLevelWidget: Widget {
    let kind: String = "YourLevelWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: YLProvider()) { entry in
            YLWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Your Level")
        .description("Your level ring and streak, right on the home screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct YLWidgetBundle: WidgetBundle {
    var body: some Widget {
        YourLevelWidget()
    }
}
