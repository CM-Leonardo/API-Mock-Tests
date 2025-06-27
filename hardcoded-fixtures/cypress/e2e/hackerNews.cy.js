import { faker } from '@faker-js/faker';

describe('Hardcodes: Utilizando fixtures para mockar a API e usar suas informações para validações dinamicas', () => {
    context('Happy Path (Caminho feliz)', () => {
        const terms = {
            cypress: 'cypress.io',
            selenium: 'selenium'
        }
        
        beforeEach(() => {
            //Mockando a API para trazer informações vazias (fazer com que o teste seja mais rapido) 
            cy.intercept(
                '**/search?query=redux&page=0&hitsPerPage=100',
                { fixture: 'empty' }
            ).as('empty')
            
            cy.intercept(
                `**/search?query=${terms.cypress}&page=0&hitsPerPage=100`,
                { fixture: 'stories' }
            ).as('stories')
            
            cy.intercept(
                `**/search?query=${terms.cypress}&page=1&hitsPerPage=100`,
                { fixture: 'incomplete' }
            ).as('stories2')
            
            // !!!! Podemos passar a mesma fixtures para intercepts que possuem rotas diferentes !!!! //
            
            cy.intercept(
                `**/search?query=${terms.selenium}&page=0&hitsPerPage=100`,
                { fixture: 'incomplete' }
            ).as('incomplete')
            
            cy.visit('https://hackernews-seven.vercel.app/')
            cy.wait('@empty')
        })

        it(`Searches by ${terms.cypress}`, () => {
            //manipulando as informações que são enviadas para o fron-end (elas vem da fixtures stories)
            cy.search(terms.cypress)
            cy.wait('@stories')
            
            //validando as informações com base no arquivo FIXTURE
            cy.fixture("stories").then((stories) => {
                cy.get('.table-row')
                    .should('have.length', stories.hits.length)
                //verifica se o numero de itens na tela, é igual de hits na fixtures (dados enviados do back)
            })
        })
        
        it('Load more', () => {
            cy.search(terms.cypress)
            cy.wait('@stories')

            cy.get('button')
                .contains('More')
                .click()
            //esperando a resposta mockada da segunda pagina
            cy.wait('@stories2')

            cy.fixture('stories').then((stories) => {
                cy.fixture('incomplete').then((incomplete) => {
                    cy.get('.table-row')
                        .should('have.length', stories.hits.length + incomplete.hits.length)

                    //Estamos fazendo o seguinte passo, pesquisamos pelo primeiro termo, logo em seguida, clicamos em More
                   //na logica do site, o more deve exibir mais buscas, no caso mockamos a API para exibir as infors do arquivo
                  //incomplete. Depois usamos o fixture para validar a primeira e segunda leva de informações carregadas. 
                })
            })
        })

        it(`Searchs by ${terms.selenium} and dismisses the first item`, () => {
            cy.search(terms.selenium)
            
            cy.wait('@incomplete')
            
            //aqui estamos validando se, ao carregar os elementos e clicar no botão Dismiss, o item é excluido da lista
           //A busca sempre é dinamica, ja que buscamos pelos itens que estão dentro da Fixture
            cy.fixture('incomplete').then((stories) => {
                cy.get('.table-row')
                    .as('tableRow')
                    .should('have.length', stories.hits.length)
                
                cy.get('.button-inline')
                    .contains('Dismiss')
                    .click()
                
                cy.get('@tableRow')
                    .should('have.length', stories.hits.length - 1)
            })
            
        })

        it('Correctly caches the results', () => {
            const randonWord = faker.word.words(1)
            let count = 0
            
            cy.intercept(`**/search?query=${randonWord}**`, (req) => {
                //implementando contador para validar quantas requisições foram feitas
                count++
                
                //impedindo que o sistema se comunica com o backend (isolando a chamada)
                req.reply({ fixture: 'empty' })
            }).as('random')
            
            cy.search(randonWord).then(() => {
                expect(count, `network calls to fetch ${randonWord}`).to.equal(1)
                
            })
            cy.wait('@random')

            //fazendo uma nova busca por um elemento diferente
            cy.search((terms.selenium))
            cy.wait('@incomplete')
    
            //validando se, ao buscar novamente pelo termo, o cache restaura as informações
            cy.search(randonWord).then(() => {
                
                //valida se não houve novas requisições
                expect(count, `network calls to fetch ${randonWord}`).to.equal(1)
            })
        })
    })
    
    context('Failure Patch (Caminho triste)', () => {
        it('Shows a fallback component on a server failure', () => {
            
            //forçando uma resposta de erro da API
            cy.intercept('**/search**', {
                statusCode: 500
            }).as('serverFailure')
            
            cy.visit('http://hackernews-seven.vercel.app/')
            
            cy.wait('@serverFailure')
            
            //Valida o erro 500
            cy.get('p').contains('Something went wrong.')
        })
    })
})