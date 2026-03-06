/**
 * Yard home — public survey catalog (Pulse View Mode).
 */
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Flame, Layers, Zap, ChevronRight, TrendingUp, MessageCircle } from 'lucide-react-native';
import { useAppTheme } from '../../../contexts/AppThemeContext';

const pulseDecks = [
  {
    id: 1,
    topic: "Tech & Society",
    question: "Will AI take your job within 5 years?",
    stat: "68%",
    statDesc: "say absolutely not.",
    votes: "12.4k",
    comments: 842,
    color: "bg-orange-100",
    accent: "bg-orange-500",
    textColor: "text-orange-900",
    accentText: "text-orange-500",
  },
  {
    id: 2,
    topic: "Lifestyle",
    question: "Remote work vs. Office culture?",
    stat: "82%",
    statDesc: "prefer hybrid models.",
    votes: "8.9k",
    comments: 1204,
    color: "bg-blue-100",
    accent: "bg-blue-500",
    textColor: "text-blue-900",
    accentText: "text-blue-500",
  },
  {
    id: 3,
    topic: "Pop Culture",
    question: "Is cinema dying?",
    stat: "45%",
    statDesc: "only watch streaming now.",
    votes: "22.1k",
    comments: 310,
    color: "bg-pink-100",
    accent: "bg-pink-500",
    textColor: "text-pink-900",
    accentText: "text-pink-500",
  }
];

function DeckCard({ deck }: { deck: typeof pulseDecks[0] }) {
  const Icon = deck.id === 1 ? Flame : deck.id === 2 ? Layers : Zap;

  return (
    <View className={`${deck.color} rounded-[32px] p-6 relative overflow-hidden shadow-sm mb-6`}>
      {/* Decorative bg element */}
      <View className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 ${deck.accent}`} />

      <View className="flex-row items-center mb-4 relative z-10">
        <View className="bg-white/50 p-2 rounded-xl mr-2">
          <Icon size={20} className={deck.accentText} color={deck.id === 1 ? "#f97316" : deck.id === 2 ? "#3b82f6" : "#ec4899"} />
        </View>
        <Text className={`font-bold text-sm uppercase tracking-wider opacity-80 ${deck.textColor}`}>{deck.topic}</Text>
      </View>

      <Text className={`text-xl font-bold mb-6 leading-tight relative z-10 ${deck.textColor}`}>
        {deck.question}
      </Text>

      <View className="bg-white/60 rounded-2xl p-5 mb-6 relative z-10 border border-white/40">
        <View className="flex-row items-baseline">
          <Text className={`text-5xl font-black ${deck.accentText}`}>{deck.stat}</Text>
        </View>
        <Text className="font-bold text-slate-700 mt-1">{deck.statDesc}</Text>
      </View>

      <View className="flex-row items-center justify-between relative z-10">
        <TouchableOpacity className="bg-slate-900 px-5 py-3 rounded-xl flex-row items-center">
          <Text className="font-bold text-sm text-white mr-2">Draw a Card</Text>
          <ChevronRight size={16} color="#fff" />
        </TouchableOpacity>

        <View className="flex-row items-center">
          <View className="flex-row items-center mr-4">
            <TrendingUp size={16} color={deck.id === 1 ? "#7c2d12" : deck.id === 2 ? "#1e3a8a" : "#831843"} />
            <Text className={`ml-1 text-sm font-bold opacity-70 ${deck.textColor}`}>{deck.votes}</Text>
          </View>
          <View className="flex-row items-center">
            <MessageCircle size={16} color={deck.id === 1 ? "#7c2d12" : deck.id === 2 ? "#1e3a8a" : "#831843"} />
            <Text className={`ml-1 text-sm font-bold opacity-70 ${deck.textColor}`}>{deck.comments}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function YardIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useAppTheme();

  return (
    <View className="flex-1 bg-slate-50" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-6 pb-24">
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-3xl font-black tracking-tight text-slate-900">Trending Decks</Text>
            <Text className="text-slate-500 font-medium mt-1">What the world is saying today.</Text>
          </View>
          <TouchableOpacity className="w-12 h-12 bg-white rounded-full shadow-sm items-center justify-center border border-slate-100">
            <Search size={20} color="#334155" />
          </TouchableOpacity>
        </View>

        <View className="mt-4">
          {pulseDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </View>
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}
