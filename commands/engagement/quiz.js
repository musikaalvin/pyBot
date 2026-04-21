const path = require('path');
/**
 * Quiz Command
 */

const axios = require('axios');
const config = require(path.join(__dirname, '../../config'));

const quizzes = new Map();

const quizQuestions = [
  { q: "What is the capital of Uganda?", options: ["Kampala", "Nairobi", "Kigali", "Dar es Salaam"], a: 0 },
  { q: "Who wrote Romeo and Juliet?", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], a: 1 },
  { q: "What is the largest planet?", options: ["Earth", "Mars", "Jupiter", "Saturn"], a: 2 },
  { q: "What is 7 x 8?", options: ["54", "56", "58", "64"], a: 1 },
  { q: "What is H2O?", options: ["Salt", "Water", "Oxygen", "Hydrogen"], a: 1 },
  { q: "Which country has the largest population?", options: ["USA", "India", "China", "Russia"], a: 1 },
  { q: "What year did WWII end?", options: ["1943", "1944", "1945", "1946"], a: 2 },
  { q: "What is the speed of light?", options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "100,000 km/s"], a: 0 },
  { q: "Which element has symbol 'Au'?", options: ["Silver", "Aluminum", "Gold", "Copper"], a: 2 },
  { q: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"], a: 2 }
];

module.exports = {
  name: 'quiz',
  aliases: ['trivia', 'question'],
  category: 'engagement',
  description: 'Play a trivia quiz',
  usage: '.quiz',
  
  async execute(sock, msg, args, extra) {
    try {
      const question = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
      const options = question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      
      await extra.reply(`*🎯 QUIZ TIME!*\n\n${question.q}\n\n${options}\n\nReply with the number (1-4)!`);
    } catch (error) {
      await extra.reply('❌ Error starting quiz!');
    }
  }
};