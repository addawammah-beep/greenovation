import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Navigation, Pagination, Mousewheel, Keyboard } from 'swiper/modules';
import './QuizComponent.css';
import correctSoundFile from './sounds/correct.mp3';
import incorrectSoundFile from './sounds/incorrect.mp3';

const questions = [
  {
    question: 'What is one effective way to reduce air pollution?',
    options: ['Burning more fossil fuels', 'Using public transportation', 'Cutting down trees'],
    correctAnswer: 'Using public transportation'
  },
  {
    question: 'Which of the following is a method to conserve water?',
    options: ['Leaving the tap running',  'Fixing leaky faucets', 'Watering plants during midday'],
    correctAnswer: 'Fixing leaky faucets'
  },
  {
    question: 'What should you avoid doing to protect soil quality?',
    options: ['Planting trees', 'Using chemical fertilizers', 'Composting organic waste'],
    correctAnswer: 'Using chemical fertilizers'
  },
  {
    question: 'What is a common source of water pollution?',
    options: ['Rainwater', 'Industrial waste', 'Filtered water'],
    correctAnswer: 'Industrial waste'
  },
  {
    question: 'How can you reduce plastic waste?',
    options: [ 'Using reusable bags', 'Buying more plastic products', 'Throwing plastic in the ocean'],
    correctAnswer: 'Using reusable bags'
  },
  {
    question: 'What is one way to protect natural habitats?',
    options: ['Dumping waste in forests', 'Participating in clean-up drives', 'Building more roads'],
    correctAnswer: 'Participating in clean-up drives'
  },
  {
    question: 'What should you do with electronic waste?',
    options: ['Throw it in the trash', 'Recycle it properly', 'Burn it'],
    correctAnswer: 'Recycle it properly'
  },
  {
    question: 'What can help in reducing greenhouse gas emissions?',
    options: ['Using renewable energy sources', 'Driving more cars', 'Increasing deforestation'],
    correctAnswer: 'Using renewable energy sources'
  },
  {
    question: 'What is a benefit of planting trees?',
    options: ['Increasing air pollution', 'Reducing carbon dioxide levels', 'Decreasing soil fertility'],
    correctAnswer: 'Reducing carbon dioxide levels'
  },
  {
    question: 'Why is it important to reduce, reuse, and recycle?',
    options: ['To increase landfill waste', 'To conserve natural resources', 'To produce more waste'],
    correctAnswer: 'To conserve natural resources'
  },
  {
    question: 'How can you reduce energy consumption at home?',
    options: ['Leaving lights on', 'Using energy-efficient appliances', 'Keeping electronics plugged in'],
    correctAnswer: 'Using energy-efficient appliances'
  },
  {
    question: 'What is one way to prevent water contamination?',
    options: ['Dumping chemicals in rivers', 'Proper disposal of hazardous waste', 'Using pesticides near water bodies'],
    correctAnswer: 'Proper disposal of hazardous waste'
  },
  {
    question: 'What is a sustainable practice in agriculture?',
    options: ['Monocropping', 'Crop rotation', 'Overusing chemical pesticides'],
    correctAnswer: 'Crop rotation'
  },
  {
    question: 'How can you help reduce air pollution?',
    options: ['Carpooling', 'Burning leaves', 'Using coal for heating'],
    correctAnswer: 'Carpooling'
  },
  {
    question: 'What is an eco-friendly alternative to plastic bottles?',
    options: ['Glass bottles', 'Single-use plastic bottles', 'Styrofoam cups'],
    correctAnswer: 'Glass bottles'
  },
  {
    question: 'Why should you conserve energy?',
    options: ['To deplete natural resources', 'To reduce environmental impact', 'To increase energy bills'],
    correctAnswer: 'To reduce environmental impact'
  },
  {
    question: 'What is a major cause of soil erosion?',
    options: ['Deforestation', 'Afforestation', 'Organic farming'],
    correctAnswer: 'Deforestation'
  },
  {
    question: 'How can you protect marine life?',
    options: ['Dumping waste in oceans', 'Reducing plastic use', 'Overfishing'],
    correctAnswer: 'Reducing plastic use'
  },
  {
    question: 'What is one benefit of using public transportation?',
    options: ['Increasing traffic congestion', 'Reducing carbon footprint', 'Burning more fuel'],
    correctAnswer: 'Reducing carbon footprint'
  },
  {
    question: 'How can you reduce your carbon footprint?',
    options: ['Using fossil fuels', 'Walking or biking', 'Leaving devices on standby'],
    correctAnswer: 'Walking or biking'
  },
  {
    question: 'Why is it important to protect wetlands?',
    options: ['To drain them for agriculture', 'To preserve biodiversity', 'To build more houses'],
    correctAnswer: 'To preserve biodiversity'
  },
  {
    question: 'What is one way to reduce noise pollution?',
    options: ['Using loudspeakers', 'Planting trees', 'Honking frequently'],
    correctAnswer: 'Planting trees'
  },
  {
    question: 'What is a sustainable way to dispose of organic waste?',
    options: ['Composting', 'Throwing it in the trash', 'Incineration'],
    correctAnswer: 'Composting'
  },
  {
    question: 'Why should you use biodegradable products?',
    options: ['They last longer', 'They decompose naturally', 'They are cheaper'],
    correctAnswer: 'They decompose naturally'
  },
  {
    question: 'What is a green alternative to using cars for short distances?',
    options: ['Walking or cycling', 'Driving alone', 'Using diesel vehicles'],
    correctAnswer: 'Walking or cycling'
  },
  {
    question: 'What is one way to conserve biodiversity?',
    options: ['Destroying natural habitats', 'Supporting wildlife conservation', 'Hunting endangered species'],
    correctAnswer: 'Supporting wildlife conservation'
  },
  {
    question: 'Why is it important to reduce paper use?',
    options: ['To increase deforestation', 'To save trees and reduce waste', 'To increase landfill waste'],
    correctAnswer: 'To save trees and reduce waste'
  },
  {
    question: 'What is one method to reduce water pollution from agriculture?',
    options: ['Using chemical pesticides', 'Practicing organic farming', 'Over-irrigation'],
    correctAnswer: 'Practicing organic farming'
  },
  {
    question: 'How can you help in reducing land pollution?',
    options: ['Littering', 'Participating in clean-up activities', 'Using plastic bags'],
    correctAnswer: 'Participating in clean-up activities'
  },
  {
    question: 'What is a benefit of using solar energy?',
    options: ['It is non-renewable', 'It reduces greenhouse gas emissions', 'It increases air pollution'],
    correctAnswer: 'It reduces greenhouse gas emissions'
  },
  {
    question: 'What is one way to protect endangered species?',
    options: ['Destroying their habitats', 'Supporting conservation programs', 'Illegal hunting'],
    correctAnswer: 'Supporting conservation programs'
  },
  {
    question: 'Why should you avoid using single-use plastics?',
    options: ['They are reusable', 'They contribute to pollution', 'They are biodegradable'],
    correctAnswer: 'They contribute to pollution'
  },
  {
    question: 'What is the impact of deforestation on the environment?',
    options: ['Increases oxygen levels', 'Reduces biodiversity', 'Improves soil quality'],
    correctAnswer: 'Reduces biodiversity'
  },
  {
    question: 'How can you help in reducing electronic waste?',
    options: ['Throwing electronics in the trash', 'Recycling electronic devices', 'Keeping old electronics indefinitely'],
    correctAnswer: 'Recycling electronic devices'
  },
  {
    question: 'What is a green alternative to chemical pesticides?',
    options: ['Using biological pest control', 'Overusing fertilizers', 'Ignoring pest problems'],
    correctAnswer: 'Using biological pest control'
  },
  {
    question: 'Why should you support local and organic farming?',
    options: ['To promote chemical use', 'To reduce transportation emissions and support sustainable practices', 'To increase food waste'],
    correctAnswer: 'To reduce transportation emissions and support sustainable practices'
  },
  {
    question: 'What is the impact of overfishing on marine ecosystems?',
    options: ['Increases fish population', 'Depletes fish stocks and disrupts ecosystems', 'Improves water quality'],
    correctAnswer: 'Depletes fish stocks and disrupts ecosystems'
  },
  {
    question: 'How can you reduce your water footprint?',
    options: ['Taking long showers', 'Fixing leaks and using water-saving fixtures', 'Watering plants excessively'],
    correctAnswer: 'Fixing leaks and using water-saving fixtures'
  },
  {
    question: 'What is an eco-friendly practice for gardening?',
    options: ['Using synthetic fertilizers', 'Composting and using natural fertilizers', 'Overwatering plants'],
    correctAnswer: 'Composting and using natural fertilizers'
  },
  {
    question: 'Why is it important to protect rainforests?',
    options: ['For urban development', 'To preserve biodiversity and regulate climate', 'To increase logging activities'],
    correctAnswer: 'To preserve biodiversity and regulate climate'
  },
  {
    question: 'What is a sustainable alternative to traditional energy sources?',
    options: ['Using coal', 'Wind and solar energy', 'Burning fossil fuels'],
    correctAnswer: 'Wind and solar energy'
  },
  {
    question: 'How can you reduce household waste?',
    options: ['Buying more packaged products', 'Recycling and composting', 'Throwing away everything'],
    correctAnswer: 'Recycling and composting'
  },
  {
    question: 'What is one way to improve indoor air quality?',
    options: ['Using air-purifying plants', 'Smoking indoors', 'Using chemical air fresheners'],
    correctAnswer: 'Using air-purifying plants'
  },
  {
    question: 'Why is it important to maintain green spaces in urban areas?',
    options: ['To build more buildings', 'To enhance air quality and provide recreational areas', 'To increase traffic'],
    correctAnswer: 'To enhance air quality and provide recreational areas'
  },
  {
    question: 'What is one way to promote environmental sustainability?',
    options: ['Ignoring environmental issues', 'Educating others and raising awareness', 'Polluting natural resources'],
    correctAnswer: 'Educating others and raising awareness'
  },
  {
    question: 'How can individuals contribute to reducing pollution?',
    options: ['By participating in environmental initiatives', 'By ignoring waste management', 'By using more plastic products'],
    correctAnswer: 'By participating in environmental initiatives'
  },
  {
    question: 'What can you do to minimize your carbon footprint?',
    options: ['Travel frequently by airplane', 'Reduce energy consumption and use renewable energy', 'Use single-use plastics'],
    correctAnswer: 'Reduce energy consumption and use renewable energy'
  }
];

const QuizComponent = () => {
  const [selectedOptions, setSelectedOptions] = useState(Array(questions.length).fill(null));
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [answerStatus, setAnswerStatus] = useState(Array(questions.length).fill(null));
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(Array(questions.length).fill(false));

  const correctSound = new Audio(correctSoundFile);
  const incorrectSound = new Audio(incorrectSoundFile);

  const handleOptionClick = (index, option) => {
    setSelectedOptions(prevOptions => {
      const newOptions = [...prevOptions];
      newOptions[index] = option;
      return newOptions;
    });
  };

  const handleSubmit = (index) => {
    if (submitted[index]) return;

    setAnswerStatus(prevStatus => {
      const newStatus = [...prevStatus];
      if (selectedOptions[index] === questions[index].correctAnswer) {
        if (newStatus[index] !== 'correct') {
          newStatus[index] = 'correct';
          setNotificationMessage('Correct answer!');
          correctSound.play();
          setScore(prevScore => prevScore + 1);
        }
      } else {
        newStatus[index] = 'incorrect';
        setNotificationMessage(`Incorrect answer! The correct answer is: ${questions[index].correctAnswer}`);
        alert(`Incorrect answer! The correct answer is: ${questions[index].correctAnswer}`);
        incorrectSound.play();
      }
      return newStatus;
    });

    setSubmitted(prevSubmitted => {
      const newSubmitted = [...prevSubmitted];
      newSubmitted[index] = true;
      return newSubmitted;
    });

    setShowNotification(true);

    setTimeout(() => {
      setShowNotification(false);
      if (index < questions.length - 1) {
        document.querySelector('.swiper-button-next').click();
      }
    }, 1500);

    setTimeout(() => {
      setAnswerStatus(prevStatus => {
        const newStatus = [...prevStatus];
        newStatus[index] = null;
        return newStatus;
      });
    }, 1500);
  };

  return (
    <section id="QuizComponent">
      <h2 className="section-title">Quiz Section</h2>
      <Swiper
        cssMode={true}
        navigation={true}
        pagination={true}
        mousewheel={true}
        keyboard={true}
        modules={[Navigation, Pagination, Mousewheel, Keyboard]}
        className="mySwiper"
      >
        {questions.map((question, index) => (
          <SwiperSlide key={index}>
            <div className="question-container" id='Quiz Section'>
              <h2 className="question-title">{question.question}</h2>
              <div className="options-container">
                {question.options.map((option) => (
                  <div
                    key={option}
                    className={`option 
                      ${selectedOptions[index] === option ? 
                        (answerStatus[index] === 'correct' ? 'correct' : answerStatus[index] === 'incorrect' ? 'incorrect' : 'selected') : ''}`}
                    onClick={() => handleOptionClick(index, option)}
                    role="radio"
                    aria-checked={selectedOptions[index] === option}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleOptionClick(index, option);
                      }
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${index}`}
                      checked={selectedOptions[index] === option}
                      readOnly
                    />
                    {option}
                  </div>
                ))}
              </div>
              <button className="QuizCompbtn" onClick={() => handleSubmit(index)}>Submit</button>
              <div className="score">Score: {score}</div>
            </div>
          </SwiperSlide>
        ))}
        {showNotification && <div className="notification">{notificationMessage}</div>}
      </Swiper>
    </section>
  );
};

export default QuizComponent;