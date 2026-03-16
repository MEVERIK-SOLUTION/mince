import asyncio
import json
import re
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging
from enum import Enum
import openai
from abc import ABC, abstractmethod
import aiohttp
import hashlib

class MessageType(Enum):
    TEXT = "text"
    IMAGE = "image"
    QUICK_REPLY = "quick_reply"
    CARD = "card"
    CAROUSEL = "carousel"

class IntentType(Enum):
    GREETING = "greeting"
    COIN_IDENTIFICATION = "coin_identification"
    PRICE_INQUIRY = "price_inquiry"
    COLLECTION_HELP = "collection_help"
    AUCTION_INFO = "auction_info"
    TECHNICAL_SUPPORT = "technical_support"
    GENERAL_QUESTION = "general_question"
    GOODBYE = "goodbye"

@dataclass
class ChatMessage:
    id: str
    user_id: str
    content: str
    message_type: MessageType
    timestamp: datetime
    is_bot: bool = False
    metadata: Dict[str, Any] = None
    intent: Optional[IntentType] = None
    confidence: float = 0.0

@dataclass
class QuickReply:
    title: str
    payload: str
    image_url: Optional[str] = None

@dataclass
class ChatCard:
    title: str
    subtitle: str
    image_url: Optional[str]
    buttons: List[Dict[str, str]]

@dataclass
class BotResponse:
    text: str
    message_type: MessageType = MessageType.TEXT
    quick_replies: List[QuickReply] = None
    cards: List[ChatCard] = None
    metadata: Dict[str, Any] = None

class IntentClassifier:
    """Klasifikátor záměrů uživatelských zpráv"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.intent_patterns = {
            IntentType.GREETING: [
                r'\b(ahoj|zdravím|dobrý|hello|hi|hey)\b',
                r'\b(začínám|začátek|pomoc)\b'
            ],
            IntentType.COIN_IDENTIFICATION: [
                r'\b(identifikuj|rozpoznej|co je to za|jaká je to)\b.*\b(mince|coin)\b',
                r'\b(mince|coin)\b.*\b(foto|obrázek|fotka)\b',
                r'\b(neznám|nevím)\b.*\b(mince|coin)\b'
            ],
            IntentType.PRICE_INQUIRY: [
                r'\b(cena|hodnota|kolik stojí|price|value)\b',
                r'\b(za kolik|prodej|nákup|aukce)\b',
                r'\b(odhad|ocenění|estimate)\b'
            ],
            IntentType.COLLECTION_HELP: [
                r'\b(kolekce|sbírka|collection)\b',
                r'\b(přidat|smazat|upravit|organizovat)\b',
                r'\b(katalog|evidence|správa)\b'
            ],
            IntentType.AUCTION_INFO: [
                r'\b(aukce|auction|dražba)\b',
                r'\b(kdy|termín|datum)\b.*\b(aukce|auction)\b',
                r'\b(aurea|antium|pešek)\b'
            ],
            IntentType.TECHNICAL_SUPPORT: [
                r'\b(problém|chyba|nefunguje|error)\b',
                r'\b(přihlášení|registrace|heslo)\b',
                r'\b(aplikace|app|web)\b.*\b(nefunguje|spadla)\b'
            ],
            IntentType.GOODBYE: [
                r'\b(nashledanou|čau|bye|goodbye|děkuji|thanks)\b',
                r'\b(konec|ukončit|zavřít)\b'
            ]
        }
    
    def classify_intent(self, message: str) -> Tuple[IntentType, float]:
        """Klasifikuje záměr zprávy"""
        message_lower = message.lower()
        best_intent = IntentType.GENERAL_QUESTION
        best_confidence = 0.0
        
        for intent, patterns in self.intent_patterns.items():
            confidence = 0.0
            matches = 0
            
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    matches += 1
                    confidence += 1.0 / len(patterns)
            
            # Bonus za více matchů
            if matches > 1:
                confidence *= 1.2
            
            if confidence > best_confidence:
                best_confidence = confidence
                best_intent = intent
        
        return best_intent, min(best_confidence, 1.0)

class KnowledgeBase:
    """Znalostní báze pro chatbota"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.knowledge = self._load_knowledge_base()
    
    def _load_knowledge_base(self) -> Dict[str, Any]:
        """Načte znalostní bázi"""
        return {
            "coin_materials": {
                "zlato": "Zlaté mince jsou obvykle investiční nebo pamětní. Hodnota závisí na obsahu zlata a vzácnosti.",
                "stříbro": "Stříbrné mince mohou být oběžné, investiční nebo sběratelské. Kontrolujte ryzost stříbra.",
                "měď": "Měděné mince jsou často starší oběžné mince. Hodnota závisí na stavu a vzácnosti.",
                "bronz": "Bronzové mince jsou obvykle starší. Pozor na patinu a korozi.",
                "nikl": "Niklové mince jsou moderní oběžné mince. Sběratelská hodnota je obvykle nízká."
            },
            "coin_conditions": {
                "MS-70": "Perfektní stav - nejvyšší možné hodnocení",
                "MS-65": "Vynikající stav - minimální vady",
                "AU-50": "Téměř nepoužitá - lehké stopy opotřebení",
                "VF-20": "Velmi jemná - mírné opotřebení",
                "F-12": "Jemná - výrazné opotřebení",
                "G-4": "Dobrá - silné opotřebení"
            },
            "auction_houses": {
                "aurea": {
                    "name": "Aurea",
                    "website": "aurea.cz",
                    "specialization": "Československé a české mince, medaile",
                    "frequency": "Měsíčně"
                },
                "antium": {
                    "name": "Antium",
                    "website": "antium.cz", 
                    "specialization": "Antické a středověké mince",
                    "frequency": "Čtvrtletně"
                },
                "pešek": {
                    "name": "Pešek Aukce",
                    "website": "pesekaukce.cz",
                    "specialization": "Široký sortiment mincí a medailí",
                    "frequency": "Měsíčně"
                }
            },
            "common_questions": {
                "jak_přidat_minci": "Pro přidání mince klikněte na tlačítko '+' v kolekci, vyplňte informace a přidejte fotografii.",
                "jak_zjistit_hodnotu": "Hodnotu mince můžete zjistit v sekci 'Odhad hodnoty' nebo sledováním aukčních výsledků.",
                "jak_exportovat_kolekci": "Kolekci můžete exportovat v nastavení aplikace do formátů CSV, Excel nebo PDF.",
                "jak_nastavit_upozornění": "Cenová upozornění nastavíte v detailu mince nebo v nastavení notifikací."
            },
            "troubleshooting": {
                "přihlášení": "Zkuste obnovit heslo nebo vymazat cache prohlížeče.",
                "pomalá_aplikace": "Zkuste obnovit stránku nebo zkontrolovat internetové připojení.",
                "chybí_fotografie": "Ujistěte se, že máte povolený přístup ke kameře v nastavení prohlížeče."
            }
        }
    
    def get_answer(self, topic: str, subtopic: str = None) -> Optional[str]:
        """Získá odpověď ze znalostní báze"""
        try:
            if topic in self.knowledge:
                if subtopic and subtopic in self.knowledge[topic]:
                    return self.knowledge[topic][subtopic]
                elif isinstance(self.knowledge[topic], str):
                    return self.knowledge[topic]
                else:
                    # Vrátí první dostupnou odpověď
                    for key, value in self.knowledge[topic].items():
                        if isinstance(value, str):
                            return value
            return None
        except Exception as e:
            self.logger.error(f"Error getting answer: {str(e)}")
            return None
    
    def search_knowledge(self, query: str) -> List[Tuple[str, str, float]]:
        """Vyhledá v znalostní bázi"""
        results = []
        query_lower = query.lower()
        
        def search_recursive(data, path=""):
            if isinstance(data, dict):
                for key, value in data.items():
                    current_path = f"{path}.{key}" if path else key
                    if isinstance(value, str):
                        # Spočítá relevanci
                        relevance = 0.0
                        if query_lower in key.lower():
                            relevance += 0.8
                        if query_lower in value.lower():
                            relevance += 0.6
                        
                        # Kontrola klíčových slov
                        query_words = query_lower.split()
                        text_words = (key + " " + value).lower().split()
                        common_words = set(query_words) & set(text_words)
                        relevance += len(common_words) * 0.2
                        
                        if relevance > 0:
                            results.append((key, value, relevance))
                    else:
                        search_recursive(value, current_path)
        
        search_recursive(self.knowledge)
        return sorted(results, key=lambda x: x[2], reverse=True)[:5]

class ChatbotService:
    """Hlavní služba chatbota"""
    
    def __init__(self, openai_api_key: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self.intent_classifier = IntentClassifier()
        self.knowledge_base = KnowledgeBase()
        self.openai_api_key = openai_api_key
        self.conversation_history: Dict[str, List[ChatMessage]] = {}
        
        if openai_api_key:
            openai.api_key = openai_api_key
    
    async def process_message(self, user_id: str, message: str, message_type: MessageType = MessageType.TEXT) -> BotResponse:
        """Zpracuje zprávu od uživatele"""
        try:
            # Vytvoří zprávu
            chat_message = ChatMessage(
                id=self._generate_message_id(),
                user_id=user_id,
                content=message,
                message_type=message_type,
                timestamp=datetime.now(),
                is_bot=False
            )
            
            # Přidá do historie
            if user_id not in self.conversation_history:
                self.conversation_history[user_id] = []
            self.conversation_history[user_id].append(chat_message)
            
            # Klasifikuje záměr
            intent, confidence = self.intent_classifier.classify_intent(message)
            chat_message.intent = intent
            chat_message.confidence = confidence
            
            # Generuje odpověď
            response = await self._generate_response(user_id, chat_message)
            
            # Přidá odpověď bota do historie
            bot_message = ChatMessage(
                id=self._generate_message_id(),
                user_id=user_id,
                content=response.text,
                message_type=response.message_type,
                timestamp=datetime.now(),
                is_bot=True,
                metadata=response.metadata
            )
            self.conversation_history[user_id].append(bot_message)
            
            return response
            
        except Exception as e:
            self.logger.error(f"Error processing message: {str(e)}")
            return BotResponse(
                text="Omlouvám se, došlo k chybě. Zkuste to prosím znovu.",
                message_type=MessageType.TEXT
            )
    
    async def _generate_response(self, user_id: str, message: ChatMessage) -> BotResponse:
        """Generuje odpověď na základě záměru"""
        intent = message.intent
        content = message.content
        
        if intent == IntentType.GREETING:
            return await self._handle_greeting(user_id)
        elif intent == IntentType.COIN_IDENTIFICATION:
            return await self._handle_coin_identification(content)
        elif intent == IntentType.PRICE_INQUIRY:
            return await self._handle_price_inquiry(content)
        elif intent == IntentType.COLLECTION_HELP:
            return await self._handle_collection_help(content)
        elif intent == IntentType.AUCTION_INFO:
            return await self._handle_auction_info(content)
        elif intent == IntentType.TECHNICAL_SUPPORT:
            return await self._handle_technical_support(content)
        elif intent == IntentType.GOODBYE:
            return await self._handle_goodbye(user_id)
        else:
            return await self._handle_general_question(content)
    
    async def _handle_greeting(self, user_id: str) -> BotResponse:
        """Zpracuje pozdrav"""
        quick_replies = [
            QuickReply("Identifikace mince", "coin_identification"),
            QuickReply("Odhad hodnoty", "price_inquiry"),
            QuickReply("Správa kolekce", "collection_help"),
            QuickReply("Aukční informace", "auction_info")
        ]
        
        return BotResponse(
            text="Zdravím! Jsem váš asistent pro správu kolekce mincí. Jak vám mohu pomoci?",
            message_type=MessageType.TEXT,
            quick_replies=quick_replies
        )
    
    async def _handle_coin_identification(self, content: str) -> BotResponse:
        """Zpracuje identifikaci mince"""
        return BotResponse(
            text="""Pro identifikaci mince mi můžete:

📸 **Poslat fotografii** - Nahrát obrázek líce a rubu mince
📝 **Popsat minci** - Uvést text, symboly, rok, velikost
🔍 **Použít vyhledávání** - V aplikaci v sekci "Vyhledávání"

**Tipy pro lepší identifikaci:**
• Fotografujte na světlém pozadí
• Zahrňte měřítko (mince, pravítko)
• Popište materiál (zlatá, stříbrná, měděná)
• Uveďte zemi původu, pokud ji znáte

Chcete začít identifikací nyní?""",
            quick_replies=[
                QuickReply("Nahrát fotografii", "upload_photo"),
                QuickReply("Popsat minci", "describe_coin"),
                QuickReply("Otevřít vyhledávání", "open_search")
            ]
        )
    
    async def _handle_price_inquiry(self, content: str) -> BotResponse:
        """Zpracuje dotaz na cenu"""
        return BotResponse(
            text="""Pro zjištění hodnoty mince potřebuji více informací:

💰 **Faktory ovlivňující cenu:**
• Materiál (zlato, stříbro, měď...)
• Stav zachování (MS-70, AU-50, VF-20...)
• Vzácnost a náklad
• Historická hodnota
• Aktuální poptávka na trhu

📊 **Kde zjistit hodnotu:**
• Aukční výsledky (Aurea, Antium, Pešek)
• Katalogy (Krause, Schön)
• Sběratelské weby
• Odborné odhady

Máte konkrétní minci, kterou chcete ocenit?""",
            quick_replies=[
                QuickReply("Ano, mám konkrétní minci", "specific_coin"),
                QuickReply("Chci se dozvědět obecně", "general_pricing"),
                QuickReply("Sledovat aukční výsledky", "auction_results")
            ]
        )
    
    async def _handle_collection_help(self, content: str) -> BotResponse:
        """Zpracuje pomoc s kolekcí"""
        cards = [
            ChatCard(
                title="Přidání mince",
                subtitle="Jak přidat novou minci do kolekce",
                image_url="/images/add-coin.png",
                buttons=[
                    {"title": "Ukázat postup", "payload": "show_add_coin"},
                    {"title": "Přidat nyní", "payload": "add_coin_now"}
                ]
            ),
            ChatCard(
                title="Organizace kolekce",
                subtitle="Kategorie, štítky a filtrování",
                image_url="/images/organize.png",
                buttons=[
                    {"title": "Nastavit kategorie", "payload": "setup_categories"},
                    {"title": "Použít filtry", "payload": "use_filters"}
                ]
            ),
            ChatCard(
                title="Export a záloha",
                subtitle="Zálohování a export dat",
                image_url="/images/export.png",
                buttons=[
                    {"title": "Exportovat kolekci", "payload": "export_collection"},
                    {"title": "Nastavit zálohu", "payload": "setup_backup"}
                ]
            )
        ]
        
        return BotResponse(
            text="Zde jsou hlavní funkce pro správu vaší kolekce:",
            message_type=MessageType.CAROUSEL,
            cards=cards
        )
    
    async def _handle_auction_info(self, content: str) -> BotResponse:
        """Zpracuje informace o aukcích"""
        auction_houses = self.knowledge_base.knowledge["auction_houses"]
        
        text = "**Hlavní české aukční domy:**\n\n"
        for key, house in auction_houses.items():
            text += f"🏛️ **{house['name']}** ({house['website']})\n"
            text += f"   • Specializace: {house['specialization']}\n"
            text += f"   • Frekvence: {house['frequency']}\n\n"
        
        text += "Chcete sledovat konkrétní aukční dům nebo typ mincí?"
        
        return BotResponse(
            text=text,
            quick_replies=[
                QuickReply("Sledovat Aurea", "follow_aurea"),
                QuickReply("Sledovat Antium", "follow_antium"),
                QuickReply("Sledovat Pešek", "follow_pesek"),
                QuickReply("Nastavit upozornění", "setup_alerts")
            ]
        )
    
    async def _handle_technical_support(self, content: str) -> BotResponse:
        """Zpracuje technickou podporu"""
        # Hledá v troubleshooting sekci
        results = self.knowledge_base.search_knowledge(content)
        
        if results:
            best_match = results[0]
            response_text = f"**{best_match[0]}:**\n{best_match[1]}\n\n"
            
            if len(results) > 1:
                response_text += "**Další možná řešení:**\n"
                for result in results[1:3]:
                    response_text += f"• {result[0]}: {result[1][:100]}...\n"
        else:
            response_text = """Omlouvám se za technické potíže. Zde jsou základní kroky řešení:

🔧 **Obecná řešení:**
• Obnovte stránku (F5 nebo Ctrl+R)
• Vymazat cache prohlížeče
• Zkontrolujte internetové připojení
• Zkuste jiný prohlížeč

📧 **Kontakt na podporu:**
• Email: support@coin-collection.app
• Telefon: +420 123 456 789
• Pracovní doba: Po-Pá 9:00-17:00"""
        
        return BotResponse(
            text=response_text,
            quick_replies=[
                QuickReply("Kontaktovat podporu", "contact_support"),
                QuickReply("Nahlásit chybu", "report_bug"),
                QuickReply("Návod k použití", "user_manual")
            ]
        )
    
    async def _handle_goodbye(self, user_id: str) -> BotResponse:
        """Zpracuje rozloučení"""
        return BotResponse(
            text="Děkuji za rozhovor! Pokud budete potřebovat pomoc s vaší kolekcí mincí, jsem tu pro vás. Přeji krásný den! 🪙",
            message_type=MessageType.TEXT
        )
    
    async def _handle_general_question(self, content: str) -> BotResponse:
        """Zpracuje obecný dotaz"""
        # Pokusí se najít odpověď ve znalostní bázi
        results = self.knowledge_base.search_knowledge(content)
        
        if results and results[0][2] > 0.3:  # Dostatečná relevance
            best_match = results[0]
            return BotResponse(
                text=f"**{best_match[0]}:**\n{best_match[1]}",
                quick_replies=[
                    QuickReply("To mi pomohlo", "helpful"),
                    QuickReply("Potřebuji více info", "more_info"),
                    QuickReply("Jiný dotaz", "other_question")
                ]
            )
        
        # Pokud nenašel odpověď, použije AI (pokud je dostupné)
        if self.openai_api_key:
            try:
                ai_response = await self._get_ai_response(content)
                return BotResponse(text=ai_response)
            except Exception as e:
                self.logger.error(f"AI response error: {str(e)}")
        
        # Fallback odpověď
        return BotResponse(
            text="""Omlouvám se, ale na tento dotaz nemám přesnou odpověď. Můžu vám pomoci s:

🪙 **Identifikací mincí** - Rozpoznání a katalogizace
💰 **Oceněním hodnoty** - Odhady a tržní ceny  
📊 **Správou kolekce** - Organizace a evidence
📅 **Aukčními informacemi** - Termíny a výsledky
🔧 **Technickou podporou** - Řešení problémů

O čem byste se chtěli dozvědět více?""",
            quick_replies=[
                QuickReply("Identifikace mincí", "coin_identification"),
                QuickReply("Odhad hodnoty", "price_inquiry"),
                QuickReply("Správa kolekce", "collection_help"),
                QuickReply("Kontakt na podporu", "contact_support")
            ]
        )
    
    async def _get_ai_response(self, content: str) -> str:
        """Získá odpověď z AI (OpenAI)"""
        try:
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": """Jsi asistent pro správu kolekce mincí. Odpovídej v češtině, stručně a užitečně. 
                        Zaměř se na numismatiku, sběratelství mincí, jejich hodnotu a historii. 
                        Pokud nevíš odpověď, přesměruj na odbornou literaturu nebo experty."""
                    },
                    {
                        "role": "user", 
                        "content": content
                    }
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            self.logger.error(f"OpenAI API error: {str(e)}")
            raise
    
    def _generate_message_id(self) -> str:
        """Generuje unikátní ID zprávy"""
        timestamp = datetime.now().isoformat()
        return hashlib.md5(timestamp.encode()).hexdigest()[:12]
    
    def get_conversation_history(self, user_id: str, limit: int = 50) -> List[ChatMessage]:
        """Získá historii konverzace"""
        if user_id in self.conversation_history:
            return self.conversation_history[user_id][-limit:]
        return []
    
    def clear_conversation_history(self, user_id: str):
        """Vymaže historii konverzace"""
        if user_id in self.conversation_history:
            del self.conversation_history[user_id]

# Factory funkce
def create_chatbot_service() -> ChatbotService:
    """Vytvoří instanci chatbot služby"""
    openai_key = os.getenv("OPENAI_API_KEY")
    return ChatbotService(openai_key)

# Příklad použití
async def example_usage():
    """Příklad použití chatbot služby"""
    chatbot = create_chatbot_service()
    user_id = "user123"
    
    # Simulace konverzace
    messages = [
        "Ahoj, potřebuji pomoc s identifikací mince",
        "Mám stříbrnou minci s orlem a nápisem 1932",
        "Kolik by mohla stát?",
        "Děkuji za pomoc"
    ]
    
    for message in messages:
        response = await chatbot.process_message(user_id, message)
        print(f"User: {message}")
        print(f"Bot: {response.text}")
        if response.quick_replies:
            print("Quick replies:", [qr.title for qr in response.quick_replies])
        print("-" * 50)

if __name__ == "__main__":
    import os
    asyncio.run(example_usage())